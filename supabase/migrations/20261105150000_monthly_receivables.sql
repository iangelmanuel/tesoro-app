-- Me deben mes a mes (SPEC 28). Una cuenta por cobrar puede ser de cobro
-- único (schedule = 'once', lo de siempre) o mensual (schedule = 'monthly'):
-- una cuota fija cada mes desde starts_on. El cobro mensual reutiliza
-- columnas de debts:
--   installment = monto mensual
--   due_day     = día de pago
--   term_months = número de cuotas (nulo = indefinida)
-- Con cuotas, opening_balance = installment × term_months; indefinida, 0 (no
-- hay saldo total). Cada cobro es un abono (payment) con period_on, el primer
-- día del mes de la cuota. El estado de cada cuota (pagada, pendiente,
-- atrasada) no se guarda: se calcula en la app con la fecha de hoy.

create type public.receivable_schedule as enum ('once', 'monthly');

alter table public.debts
  add column schedule public.receivable_schedule, -- solo cuentas por cobrar
  add column starts_on date;                      -- inicio del cobro mensual

comment on column public.debts.schedule is
  'Cuenta por cobrar: cobro único (once) o mensual (monthly). Nulo en tarjetas y préstamos';
comment on column public.debts.starts_on is
  'Cuenta por cobrar mensual: fecha de inicio del cobro';

-- Las cuentas por cobrar existentes son de cobro único
update public.debts set schedule = 'once' where kind = 'receivable';

-- El check por tipo de debts (SPEC 06) no tiene nombre propio: se busca por
-- su definición y se reemplaza por uno con nombre
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'public.debts'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%''receivable''%'
    and pg_get_constraintdef(c.oid) like '%credit_limit IS NOT NULL%';

  if v_name is null then
    raise exception 'No se encontró el check por tipo de public.debts';
  end if;

  execute format('alter table public.debts drop constraint %I', v_name);
end;
$$;

alter table public.debts
  add constraint debts_kind_fields_check check (
    case kind
      when 'credit_card' then
        credit_limit is not null and due_day is not null
        and installment is null and original_amount is null
        and term_months is null and expected_on is null
        and schedule is null and starts_on is null
      when 'loan' then
        installment is not null and due_day is not null
        and interest_rate is not null and opening_balance > 0
        and credit_limit is null and min_payment is null
        and closing_day is null and expected_on is null
        and schedule is null and starts_on is null
      when 'receivable' then
        coalesce(
          interest_rate is null
          and credit_limit is null and min_payment is null
          and closing_day is null and original_amount is null
          and (
            (
              schedule = 'once'
              and opening_balance > 0
              and installment is null and due_day is null
              and term_months is null and starts_on is null
            )
            or (
              schedule = 'monthly'
              and installment is not null and due_day is not null
              and starts_on is not null and expected_on is null
              and (
                (term_months is not null and opening_balance = installment * term_months)
                or (term_months is null and opening_balance = 0)
              )
            )
          ),
          false
        )
    end
  );

-- Cuota cobrada de una cuenta por cobrar mensual
alter table public.debt_entries
  add column period_on date, -- primer día del mes de la cuota cobrada
  add constraint debt_entries_period_on_first_day_check
    check (period_on is null or extract(day from period_on) = 1);

comment on column public.debt_entries.period_on is
  'Cobro mensual: primer día del mes de la cuota que cobra este abono';

-- Una cuota solo admite un cobro
create unique index debt_entries_one_payment_per_period
  on public.debt_entries (debt_id, period_on)
  where period_on is not null;

-- check_debt_update (SPEC 06): tampoco cambia el tipo de cobro
create or replace function public.check_debt_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.kind <> old.kind then
    raise exception 'El tipo de una deuda no se puede cambiar'
      using errcode = 'check_violation';
  end if;

  if new.schedule is distinct from old.schedule then
    raise exception 'El tipo de cobro no se puede cambiar'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- check_debt_entry (SPEC 06, 16, 17 y 19) con las reglas de period_on: solo
-- en abonos de cuentas por cobrar mensuales y obligatorio en ellos, desde el
-- mes de inicio y, con número de cuotas, hasta el mes de la última
create or replace function public.check_debt_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.debt_kind;
  v_status public.debt_status;
  v_schedule public.receivable_schedule;
  v_starts_on date;
  v_term_months smallint;
  v_first_period date;
begin
  if tg_op = 'DELETE' then
    select status into v_status
    from public.debts
    where id = old.debt_id
    for update;

    -- Sin deuda: borrado en cascada desde la deuda o el espacio
    if not found then
      return old;
    end if;

    if v_status <> 'active' then
      raise exception 'Reactiva la deuda para registrar pagos'
        using errcode = 'check_violation';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.debt_id <> old.debt_id or new.kind <> old.kind then
      raise exception 'Una entrada no puede cambiar de deuda ni de tipo'
        using errcode = 'check_violation';
    end if;

    -- Solo cambian hora u orden del día: no afecta el saldo
    if new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.transaction_id is not distinct from old.transaction_id
      and new.account_id is not distinct from old.account_id
      and new.period_on is not distinct from old.period_on
    then
      return new;
    end if;

    -- Quitar el enlace al borrar el movimiento (on delete set null) se
    -- permite aunque la deuda no esté activa: no cambia el saldo
    if new.transaction_id is null
      and old.transaction_id is not null
      and new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.period_on is not distinct from old.period_on
    then
      return new;
    end if;
  end if;

  select kind, status, schedule, starts_on, term_months
    into v_kind, v_status, v_schedule, v_starts_on, v_term_months
  from public.debts
  where id = new.debt_id
  for update;

  if not found or v_status <> 'active' then
    raise exception 'Reactiva la deuda para registrar pagos'
      using errcode = 'check_violation';
  end if;

  if new.occurred_on > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha no puede ser futura'
      using errcode = 'check_violation';
  end if;

  if new.kind = 'advance' and v_kind <> 'credit_card' then
    raise exception 'Solo una tarjeta admite avances'
      using errcode = 'check_violation';
  end if;

  if new.kind = 'fee' and (v_kind <> 'credit_card' or new.amount <= 0) then
    raise exception 'Solo una tarjeta admite cuotas de manejo mayores a cero'
      using errcode = 'check_violation';
  end if;

  -- En préstamos y cuentas por cobrar la cuenta va en el movimiento
  if new.account_id is not null
    and (new.kind not in ('payment', 'advance') or v_kind <> 'credit_card')
  then
    raise exception 'Solo los pagos y avances de una tarjeta llevan cuenta'
      using errcode = 'check_violation';
  end if;

  -- Cuotas del cobro mensual
  if v_kind = 'receivable' and v_schedule = 'monthly' and new.kind = 'payment' then
    if new.period_on is null then
      raise exception 'Elige la cuota que se cobra'
        using errcode = 'check_violation';
    end if;

    v_first_period := date_trunc('month', v_starts_on::timestamp)::date;

    if new.period_on < v_first_period then
      raise exception 'La cuota es anterior al inicio del cobro'
        using errcode = 'check_violation';
    end if;

    if v_term_months is not null
      and new.period_on > (v_first_period + make_interval(months => v_term_months - 1))::date
    then
      raise exception 'La cuota es posterior a la última cuota'
        using errcode = 'check_violation';
    end if;
  elsif new.period_on is not null then
    raise exception 'Solo los cobros de una cuenta por cobrar mensual llevan cuota'
      using errcode = 'check_violation';
  end if;

  if new.transaction_id is not null and not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id
      and t.workspace_id = new.workspace_id
      and (
        (v_kind = 'loan' and t.type = 'expense')
        or (v_kind = 'receivable' and t.type = 'income')
      )
  ) then
    raise exception 'El movimiento no corresponde a esta deuda'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- check_debt_balance (SPEC 17): una cuenta por cobrar mensual indefinida no
-- tiene saldo total, así que no se valida
create or replace function public.check_debt_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_debt_id uuid;
  v_balance numeric;
  v_open_ended boolean;
begin
  if tg_table_name = 'debts' then
    v_debt_id := new.id;
  elsif tg_op = 'DELETE' then
    v_debt_id := old.debt_id;
  else
    v_debt_id := new.debt_id;
  end if;

  select d.opening_balance
         - coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0)
         + coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance', 'fee')), 0),
         d.kind = 'receivable' and d.schedule = 'monthly' and d.term_months is null
    into v_balance, v_open_ended
  from public.debts d
  left join public.debt_entries e on e.debt_id = d.id
  where d.id = v_debt_id
  group by d.id;

  if v_balance < 0 and not v_open_ended then
    raise exception 'El saldo de la deuda no puede quedar negativo'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

-- record_debt_payment (SPEC 26) gana p_period_on: la cuota que cobra un abono
-- de una cuenta por cobrar mensual. check_debt_entry valida la cuota y el
-- índice único rechaza un segundo cobro de la misma.
drop function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean);

create function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean,
  p_account_id uuid default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null,
  p_occurred_time time default null,
  p_is_extra_payment boolean default false,
  p_period_on date default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_type public.transaction_type;
  v_category_id uuid;
  v_transaction_id uuid;
  v_entry_account_id uuid;
  v_entry_id uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id;

  if not found then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  if p_create_transaction and v_debt.kind = 'credit_card' then
    raise exception 'Un pago de tarjeta no crea un movimiento'
      using errcode = 'check_violation';
  end if;

  if p_is_extra_payment and v_debt.kind = 'receivable' then
    raise exception 'Una cuenta por cobrar no tiene abonos extra'
      using errcode = 'check_violation';
  end if;

  if p_transfer_from is not null then
    if p_account_id is null
      or not (v_debt.kind = 'credit_card' or (v_debt.kind = 'loan' and p_create_transaction))
    then
      raise exception 'El traspaso necesita una cuenta que pague'
        using errcode = 'check_violation';
    end if;

    perform public.create_payment_transfer(
      v_debt.workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on, p_occurred_time
    );
  end if;

  if p_create_transaction then
    v_type := case v_debt.kind when 'loan' then 'expense' else 'income' end;

    select id into v_category_id
    from public.categories
    where workspace_id is null
      and scope = 'personal'
      and type = v_type
      and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, occurred_time,
      description, account_id
    ) values (
      v_debt.workspace_id,
      v_type,
      p_amount,
      v_category_id,
      p_occurred_on,
      p_occurred_time,
      case
        when v_type = 'income' or p_is_extra_payment then 'Abono '
        else 'Pago '
      end || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  elsif v_debt.kind = 'credit_card' then
    v_entry_account_id := p_account_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, occurred_time, note,
    transaction_id, account_id, is_extra_payment, period_on
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_occurred_time,
    p_note,
    v_transaction_id,
    v_entry_account_id,
    p_is_extra_payment,
    p_period_on
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean, date) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean, date) to authenticated;

-- debt_overview (SPEC 26) con schedule y starts_on al final. Cambia el tipo
-- de retorno, así que se recrea.
drop function public.debt_overview(uuid);

create function public.debt_overview(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  kind public.debt_kind,
  name text,
  counterparty text,
  opening_balance numeric,
  credit_limit numeric,
  min_payment numeric,
  closing_day smallint,
  installment numeric,
  original_amount numeric,
  term_months smallint,
  interest_rate numeric,
  rate_type public.rate_type,
  due_day smallint,
  expected_on date,
  status public.debt_status,
  closed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  fee_amount numeric,
  fee_day smallint,
  fee_charged_through date,
  balance numeric,
  paid_total numeric,
  entries_count bigint,
  last_payment_on date,
  next_due_on date,
  prev_due_on date,
  paid_current_cycle numeric,
  paid_previous_cycle numeric,
  schedule public.receivable_schedule,
  starts_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Bogota')::date as value
  ),
  -- Mes del primer vencimiento ≥ hoy
  next_months as (
    select d.id, d.due_day, t.value as today,
           case
             when date_trunc('month', t.value::timestamp)::date
                  + least(
                      d.due_day::int,
                      extract(day from date_trunc('month', t.value::timestamp) + interval '1 month' - interval '1 day')::int
                    )
                  - 1 >= t.value
               then date_trunc('month', t.value::timestamp)
             else date_trunc('month', t.value::timestamp) + interval '1 month'
           end as next_month
    from public.debts d, today t
    where d.workspace_id = p_workspace_id
      and d.kind <> 'receivable'
  ),
  -- D_n, D_b y D_bb
  cycles as (
    select n.id, n.today,
           max(x.due_on) filter (where x.k = 0) as next_due_on,
           max(x.due_on) filter (where x.k = 1) as prev_due_on,
           max(x.due_on) filter (where x.k = 2) as prev_prev_due_on
    from next_months n
    cross join lateral (
      select g.k,
             m.month::date
             + least(
                 n.due_day::int,
                 extract(day from m.month + interval '1 month' - interval '1 day')::int
               )
             - 1 as due_on
      from generate_series(0, 2) as g (k)
      cross join lateral (
        select n.next_month - make_interval(months => g.k) as month
      ) m
    ) x
    group by n.id, n.today
  ),
  cycle_paid as (
    select c.id,
           coalesce(sum(e.amount) filter (
             where e.occurred_on > c.prev_due_on and e.occurred_on <= c.today
           ), 0) as paid_current_cycle,
           coalesce(sum(e.amount) filter (
             where e.occurred_on > c.prev_prev_due_on and e.occurred_on <= c.prev_due_on
           ), 0) as paid_previous_cycle
    from cycles c
    left join public.debt_entries e
      on e.debt_id = c.id
     and e.kind = 'payment'
     and not e.is_extra_payment
    group by c.id
  ),
  totals as (
    select e.debt_id,
           coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0) as paid_total,
           coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance', 'fee')), 0) as adjusted_total,
           count(*) as entries_count,
           max(e.occurred_on) filter (where e.kind = 'payment') as last_payment_on
    from public.debt_entries e
    where e.workspace_id = p_workspace_id
    group by e.debt_id
  )
  select d.id, d.workspace_id, d.kind, d.name, d.counterparty,
         d.opening_balance, d.credit_limit, d.min_payment, d.closing_day,
         d.installment, d.original_amount, d.term_months,
         d.interest_rate, d.rate_type, d.due_day, d.expected_on,
         d.status, d.closed_at, d.created_at, d.updated_at,
         d.fee_amount, d.fee_day, d.fee_charged_through,
         d.opening_balance - coalesce(t.paid_total, 0) + coalesce(t.adjusted_total, 0),
         coalesce(t.paid_total, 0),
         coalesce(t.entries_count, 0),
         t.last_payment_on,
         c.next_due_on,
         c.prev_due_on,
         cp.paid_current_cycle,
         cp.paid_previous_cycle,
         d.schedule,
         d.starts_on
  from public.debts d
  left join totals t on t.debt_id = d.id
  left join cycles c on c.id = d.id
  left join cycle_paid cp on cp.id = d.id
  where d.workspace_id = p_workspace_id
  order by d.created_at;
$$;

revoke execute on function public.debt_overview(uuid) from public, anon;
grant execute on function public.debt_overview(uuid) to authenticated;
