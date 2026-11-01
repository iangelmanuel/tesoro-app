-- Pagos desde cuentas, traspaso al pagar y avances de tarjeta (SPEC 16). El
-- pago o avance de una tarjeta y el aporte a una meta mueven una cuenta sin
-- ser ingreso ni gasto: llevan account_id propio, sin fila en transactions.
-- El saldo sigue calculado:
--   saldo deuda  = opening_balance − Σ payment + Σ adjustment + Σ advance
--   saldo cuenta = (SPEC 08c) − Σ payment con cuenta + Σ advance con cuenta
--                  − Σ goal_contributions con cuenta

-- Columnas. La FK usa no action (no restrict) por la misma razón que
-- 20261030231457: restrict rompe la cascada al borrar un usuario (SPEC 09).
alter table public.debt_entries
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete no action,
  -- Con movimiento enlazado, la cuenta es la del movimiento
  add check (account_id is null or transaction_id is null);

-- amount > 0 salvo ajuste: reafirma que advance exige amount > 0
alter table public.debt_entries
  drop constraint debt_entries_check,
  add check (kind = 'adjustment' or amount > 0);

alter table public.goal_contributions
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete no action;

create index debt_entries_account on public.debt_entries (account_id)
  where account_id is not null;
create index goal_contributions_account on public.goal_contributions (account_id)
  where account_id is not null;

-- Una cuenta archivada no se usa en filas nuevas
create trigger debt_entries_check_account_active
  before insert or update on public.debt_entries
  for each row execute function public.check_account_active();

create trigger goal_contributions_check_account_active
  before insert or update on public.goal_contributions
  for each row execute function public.check_account_active();

-- check_debt_entry (SPEC 06) con las reglas de avance y cuenta
create or replace function public.check_debt_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.debt_kind;
  v_status public.debt_status;
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

    -- Quitar el enlace al borrar el movimiento (on delete set null) se
    -- permite aunque la deuda no esté activa: no cambia el saldo
    if new.transaction_id is null
      and old.transaction_id is not null
      and new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
    then
      return new;
    end if;
  end if;

  select kind, status into v_kind, v_status
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

  -- En préstamos y cuentas por cobrar la cuenta va en el movimiento
  if new.account_id is not null
    and (new.kind not in ('payment', 'advance') or v_kind <> 'credit_card')
  then
    raise exception 'Solo los pagos y avances de una tarjeta llevan cuenta'
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

-- check_debt_balance (SPEC 06) suma los avances
create or replace function public.check_debt_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_debt_id uuid;
  v_balance numeric;
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
         + coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance')), 0)
    into v_balance
  from public.debts d
  left join public.debt_entries e on e.debt_id = d.id
  where d.id = v_debt_id
  group by d.id;

  if v_balance < 0 then
    raise exception 'El saldo de la deuda no puede quedar negativo'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

-- debt_overview (SPEC 06): el saldo suma los avances
create or replace function public.debt_overview(p_workspace_id uuid)
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
  balance numeric,
  paid_total numeric,
  entries_count bigint,
  last_payment_on date,
  next_due_on date,
  prev_due_on date,
  paid_current_cycle numeric,
  paid_previous_cycle numeric
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
      on e.debt_id = c.id and e.kind = 'payment'
    group by c.id
  ),
  totals as (
    select e.debt_id,
           coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0) as paid_total,
           coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance')), 0) as adjusted_total,
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
         d.opening_balance - coalesce(t.paid_total, 0) + coalesce(t.adjusted_total, 0),
         coalesce(t.paid_total, 0),
         coalesce(t.entries_count, 0),
         t.last_payment_on,
         c.next_due_on,
         c.prev_due_on,
         cp.paid_current_cycle,
         cp.paid_previous_cycle
  from public.debts d
  left join totals t on t.debt_id = d.id
  left join cycles c on c.id = d.id
  left join cycle_paid cp on cp.id = d.id
  where d.workspace_id = p_workspace_id
  order by d.created_at;
$$;

-- score_balances (SPEC 07): el saldo de la deuda suma los avances
create or replace function public.score_balances(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (kind text, entity_id uuid, month date, balance numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select m.month::date as month,
           (m.month + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as m (month)
  ),
  debt_balances as (
    select 'debt'::text as kind, d.id, m.month,
           d.opening_balance
           - coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0)
           + coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance')), 0) as balance
    from public.debts d
    join months m
      on (d.created_at at time zone 'America/Bogota')::date <= m.month_end
    left join public.debt_entries e
      on e.debt_id = d.id
      and e.occurred_on <= m.month_end
    where d.workspace_id = p_workspace_id
      and d.kind <> 'receivable'
    group by d.id, m.month
  ),
  goal_balances as (
    select 'goal'::text as kind, g.id, m.month,
           coalesce(sum(c.amount), 0) as balance
    from public.savings_goals g
    cross join months m
    left join public.goal_contributions c
      on c.goal_id = g.id
      and c.occurred_on <= m.month_end
    where g.workspace_id = p_workspace_id
    group by g.id, m.month
  )
  select * from debt_balances
  union all
  select * from goal_balances
  order by 1, 2, 3;
$$;

-- ledger_entries (SPEC 08c) con pagos y avances de tarjeta y aportes de
-- metas que llevan cuenta. Su description es el nombre de la deuda o la
-- meta; en los aportes, el signo del monto distingue aporte y retiro. Las
-- columnas van en el mismo orden que antes.
create or replace view public.ledger_entries
with (security_invoker = true)
as
  select t.id, t.workspace_id, t.type::text as kind, t.amount, t.occurred_on,
         t.created_at, t.account_id, null::uuid as to_account_id,
         t.category_id, t.description, t.note,
         t.counterparty, t.invoice_ref
  from public.transactions t
  union all
  select tr.id, tr.workspace_id, 'transfer', tr.amount, tr.occurred_on,
         tr.created_at, tr.from_account_id, tr.to_account_id,
         null::uuid, null::text, tr.note,
         null::text, null::text
  from public.transfers tr
  union all
  select a.id, a.workspace_id, 'adjustment', a.amount, a.occurred_on,
         a.created_at, a.account_id, null::uuid,
         null::uuid, null::text, a.note,
         null::text, null::text
  from public.account_adjustments a
  union all
  select e.id, e.workspace_id, 'debt_' || e.kind::text, e.amount, e.occurred_on,
         e.created_at, e.account_id, null::uuid,
         null::uuid, d.name, e.note,
         null::text, null::text
  from public.debt_entries e
  join public.debts d on d.id = e.debt_id
  where e.account_id is not null
  union all
  select c.id, c.workspace_id, 'goal_contribution', c.amount, c.occurred_on,
         c.created_at, c.account_id, null::uuid,
         null::uuid, g.name, c.note,
         null::text, null::text
  from public.goal_contributions c
  join public.savings_goals g on g.id = c.goal_id
  where c.account_id is not null;

-- account_balances (SPEC 08c) con los tres orígenes nuevos
create or replace function public.account_balances(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  kind public.account_kind,
  icon text,
  color text,
  opening_balance numeric,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  balance numeric,
  scheduled_balance numeric,
  last_activity_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Bogota')::date as value
  ),
  deltas as (
    select t.account_id,
           case t.type when 'income' then t.amount else -t.amount end as delta,
           t.occurred_on
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.account_id is not null
    union all
    select tr.from_account_id, -tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select tr.to_account_id, tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select a.account_id, a.amount, a.occurred_on
    from public.account_adjustments a
    where a.workspace_id = p_workspace_id
    union all
    select e.account_id,
           case e.kind when 'advance' then e.amount else -e.amount end,
           e.occurred_on
    from public.debt_entries e
    where e.workspace_id = p_workspace_id
      and e.account_id is not null
    union all
    select c.account_id, -c.amount, c.occurred_on
    from public.goal_contributions c
    where c.workspace_id = p_workspace_id
      and c.account_id is not null
  ),
  totals as (
    select d.account_id,
           coalesce(sum(d.delta) filter (where d.occurred_on <= t.value), 0) as to_date,
           sum(d.delta) as scheduled,
           max(d.occurred_on) filter (where d.occurred_on <= t.value) as last_activity_on
    from deltas d, today t
    group by d.account_id
  )
  select a.id, a.workspace_id, a.name, a.kind, a.icon, a.color,
         a.opening_balance, a.archived_at, a.created_at, a.updated_at,
         a.opening_balance + coalesce(t.to_date, 0),
         a.opening_balance + coalesce(t.scheduled, 0),
         t.last_activity_on
  from public.accounts a
  left join totals t on t.account_id = a.id
  where a.workspace_id = p_workspace_id
  order by a.created_at;
$$;

-- account_monthly_balances (SPEC 11) usa las mismas reglas de deltas
create or replace function public.account_monthly_balances(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (month date, balance numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select m.month::date as month,
           (m.month + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as m (month)
  ),
  active as (
    select a.id, a.opening_balance,
           (a.created_at at time zone 'America/Bogota')::date as created_on
    from public.accounts a
    where a.workspace_id = p_workspace_id
      and a.archived_at is null
  ),
  deltas as (
    select t.account_id,
           case t.type when 'income' then t.amount else -t.amount end as delta,
           t.occurred_on
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.account_id is not null
    union all
    select tr.from_account_id, -tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select tr.to_account_id, tr.amount, tr.occurred_on
    from public.transfers tr
    where tr.workspace_id = p_workspace_id
    union all
    select a.account_id, a.amount, a.occurred_on
    from public.account_adjustments a
    where a.workspace_id = p_workspace_id
    union all
    select e.account_id,
           case e.kind when 'advance' then e.amount else -e.amount end,
           e.occurred_on
    from public.debt_entries e
    where e.workspace_id = p_workspace_id
      and e.account_id is not null
    union all
    select c.account_id, -c.amount, c.occurred_on
    from public.goal_contributions c
    where c.workspace_id = p_workspace_id
      and c.account_id is not null
  ),
  active_deltas as (
    select d.delta, d.occurred_on
    from deltas d
    join active a on a.id = d.account_id
  )
  select m.month,
         coalesce((
           select sum(a.opening_balance)
           from active a
           where a.created_on <= m.month_end
         ), 0)
         + coalesce((
           select sum(d.delta)
           from active_deltas d
           where d.occurred_on <= m.month_end
         ), 0)
  from months m
  order by m.month;
$$;

-- RPC. Todas security invoker: RLS y los triggers validan espacio, estado,
-- fecha, saldo y cuenta archivada.

-- Traspaso previo al pago. Falla si no hay cuenta destino; la restricción
-- from <> to de transfers rechaza el mismo origen y destino.
create function public.create_payment_transfer(
  p_workspace_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_occurred_on date
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_to is null then
    raise exception 'El traspaso necesita una cuenta de destino'
      using errcode = 'check_violation';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del traspaso debe ser mayor a cero'
      using errcode = 'check_violation';
  end if;

  insert into public.transfers (
    workspace_id, from_account_id, to_account_id, amount, occurred_on
  ) values (
    p_workspace_id, p_from, p_to, p_amount, p_occurred_on
  );
end;
$$;

-- Función interna de las RPC: no se expone
revoke execute on function public.create_payment_transfer(uuid, uuid, uuid, numeric, date) from public, anon, authenticated;

-- record_debt_payment (SPEC 08c y 10) con cuenta en la entrada de una tarjeta
-- y traspaso previo. En préstamo y cuenta por cobrar la cuenta va al
-- movimiento. El traspaso solo aplica si el pago sale de una cuenta: tarjeta o
-- préstamo con movimiento.
drop function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid);

create function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean,
  p_account_id uuid default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null
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

  if p_transfer_from is not null then
    if p_account_id is null
      or not (v_debt.kind = 'credit_card' or (v_debt.kind = 'loan' and p_create_transaction))
    then
      raise exception 'El traspaso necesita una cuenta que pague'
        using errcode = 'check_violation';
    end if;

    perform public.create_payment_transfer(
      v_debt.workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on
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
      workspace_id, type, amount, category_id, occurred_on, description, account_id
    ) values (
      v_debt.workspace_id,
      v_type,
      p_amount,
      v_category_id,
      p_occurred_on,
      case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  elsif v_debt.kind = 'credit_card' then
    v_entry_account_id := p_account_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id,
    account_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_note,
    v_transaction_id,
    v_entry_account_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- Avance de tarjeta: sube el saldo de la deuda y, con cuenta, el de la
-- cuenta. No lleva traspaso.
create function public.record_card_advance(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_account_id uuid default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_entry_id uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id;

  if not found then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  if v_debt.kind <> 'credit_card' then
    raise exception 'Solo una tarjeta admite avances'
      using errcode = 'check_violation';
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, note, account_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'advance',
    p_amount,
    p_occurred_on,
    p_note,
    p_account_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

-- Aporte o retiro de una meta, con cuenta y traspaso previo. Un retiro
-- (monto negativo) ignora el traspaso.
create function public.record_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_account_id uuid default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.savings_goals
  where id = p_goal_id;

  if not found then
    raise exception 'La meta no existe'
      using errcode = 'no_data_found';
  end if;

  if p_transfer_from is not null and p_amount > 0 then
    perform public.create_payment_transfer(
      v_workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on
    );
  end if;

  insert into public.goal_contributions (
    workspace_id, goal_id, amount, occurred_on, note, account_id
  ) values (
    v_workspace_id, p_goal_id, p_amount, p_occurred_on, p_note, p_account_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Movimiento con traspaso previo, en una sola transacción. Mismas columnas
-- que el insert de createTransaction.
create function public.record_transaction(
  p_workspace_id uuid,
  p_type public.transaction_type,
  p_amount numeric,
  p_category_id uuid,
  p_occurred_on date,
  p_description text,
  p_note text default null,
  p_account_id uuid default null,
  p_recurring_expense_id uuid default null,
  p_recurring_due_on date default null,
  p_counterparty text default null,
  p_invoice_ref text default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_transfer_from is not null then
    if p_type <> 'expense' then
      raise exception 'Solo un gasto admite traspaso al registrar'
        using errcode = 'check_violation';
    end if;

    perform public.create_payment_transfer(
      p_workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on
    );
  end if;

  insert into public.transactions (
    workspace_id, type, amount, category_id, occurred_on, description, note,
    account_id, recurring_expense_id, recurring_due_on, counterparty,
    invoice_ref
  ) values (
    p_workspace_id, p_type, p_amount, p_category_id, p_occurred_on,
    p_description, p_note, p_account_id, p_recurring_expense_id,
    p_recurring_due_on, p_counterparty, p_invoice_ref
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric) to authenticated;

revoke execute on function public.record_card_advance(uuid, numeric, date, text, uuid) from public, anon;
grant execute on function public.record_card_advance(uuid, numeric, date, text, uuid) to authenticated;

revoke execute on function public.record_goal_contribution(uuid, numeric, date, text, uuid, uuid, numeric) from public, anon;
grant execute on function public.record_goal_contribution(uuid, numeric, date, text, uuid, uuid, numeric) to authenticated;

revoke execute on function public.record_transaction(uuid, public.transaction_type, numeric, uuid, date, text, text, uuid, uuid, date, text, text, uuid, numeric) from public, anon;
grant execute on function public.record_transaction(uuid, public.transaction_type, numeric, uuid, date, text, text, uuid, uuid, date, text, text, uuid, numeric) to authenticated;
