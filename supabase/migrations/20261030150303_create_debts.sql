-- Tarjetas de crédito, préstamos y cuentas por cobrar, con sus pagos y
-- ajustes (SPEC 06). El saldo no se guarda: es opening_balance − pagos +
-- ajustes. Un pago de préstamo o un abono puede crear su movimiento; un pago
-- de tarjeta nunca, porque las compras ya son gastos.

create type public.debt_kind as enum ('credit_card', 'loan', 'receivable');
create type public.debt_status as enum ('active', 'paid', 'archived');
create type public.rate_type as enum ('ea', 'mv');
create type public.debt_entry_kind as enum ('payment', 'adjustment');

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.debt_kind not null,
  name text not null check (char_length(name) between 1 and 60),
  counterparty text check (char_length(counterparty) <= 60), -- entidad, acreedor o deudor
  opening_balance numeric(14, 2) not null check (opening_balance >= 0),
  credit_limit numeric(14, 2) check (credit_limit > 0),       -- tarjeta
  min_payment numeric(14, 2) check (min_payment > 0),         -- tarjeta
  closing_day smallint check (closing_day between 1 and 31),  -- tarjeta
  installment numeric(14, 2) check (installment > 0),         -- préstamo
  original_amount numeric(14, 2) check (original_amount > 0), -- préstamo
  term_months smallint check (term_months between 1 and 600), -- préstamo
  interest_rate numeric(6, 3) check (interest_rate >= 0),     -- porcentaje
  rate_type public.rate_type,
  due_day smallint check (due_day between 1 and 31),          -- tarjeta y préstamo
  expected_on date,                                           -- cuenta por cobrar
  status public.debt_status not null default 'active',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((interest_rate is null) = (rate_type is null)),
  check (rate_type <> 'ea' or interest_rate <= 200),
  check (rate_type <> 'mv' or interest_rate <= 10),
  check ((status = 'paid') = (closed_at is not null)),
  check (
    case kind
      when 'credit_card' then
        credit_limit is not null and due_day is not null
        and installment is null and original_amount is null
        and term_months is null and expected_on is null
      when 'loan' then
        installment is not null and due_day is not null
        and interest_rate is not null and opening_balance > 0
        and credit_limit is null and min_payment is null
        and closing_day is null and expected_on is null
      when 'receivable' then
        opening_balance > 0 and interest_rate is null
        and credit_limit is null and min_payment is null
        and closing_day is null and installment is null
        and original_amount is null and term_months is null
        and due_day is null
    end
  ),
  -- Destino de la FK compuesta de debt_entries
  unique (id, workspace_id)
);

create index debts_workspace on public.debts (workspace_id);

create table public.debt_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  debt_id uuid not null,
  kind public.debt_entry_kind not null,
  amount numeric(14, 2) not null check (amount <> 0), -- ajuste: > 0 sube el saldo, < 0 lo baja
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  transaction_id uuid unique references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'adjustment' or amount > 0),
  check (kind = 'payment' or transaction_id is null),
  -- La entrada siempre es del mismo espacio que su deuda
  foreign key (debt_id, workspace_id)
    references public.debts (id, workspace_id) on delete cascade
);

create index debt_entries_debt
  on public.debt_entries (debt_id, occurred_on desc, created_at desc);

insert into public.categories (workspace_id, type, name, icon, color) values
  (null, 'expense', 'Deudas', 'landmark', 'slate'),
  (null, 'income', 'Cobros', 'coins', 'teal');

-- Triggers
create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

create trigger debt_entries_set_updated_at
  before update on public.debt_entries
  for each row execute function public.set_updated_at();

-- El tipo de una deuda no cambia: cada tipo tiene campos distintos
create function public.check_debt_update()
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

  return new;
end;
$$;

create trigger debts_check_update
  before update on public.debts
  for each row execute function public.check_debt_update();

-- Solo se registran, editan o borran entradas de deudas activas, sin cambiar
-- de deuda ni de tipo, con fecha hasta hoy (America/Bogota) y con un
-- movimiento que corresponda al tipo de la deuda. Bloquea la fila de la deuda
-- para que check_debt_balance no corra en paralelo con otra entrada.
create function public.check_debt_entry()
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

create trigger debt_entries_check_entry
  before insert or update or delete on public.debt_entries
  for each row execute function public.check_debt_entry();

-- El saldo de la deuda nunca queda negativo, aunque el cliente se salte la
-- validación. Cubre pagos, ajustes, ediciones, borrados y cambios del saldo
-- inicial.
create function public.check_debt_balance()
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
         + coalesce(sum(e.amount) filter (where e.kind = 'adjustment'), 0)
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

create trigger debt_entries_check_balance
  after insert or update or delete on public.debt_entries
  for each row execute function public.check_debt_balance();

create trigger debts_check_balance
  after update of opening_balance on public.debts
  for each row execute function public.check_debt_balance();

-- El pago manda sobre su movimiento: editar el pago copia monto y fecha, y
-- borrarlo borra el movimiento
create function public.sync_debt_entry_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.transaction_id is not null then
      delete from public.transactions where id = old.transaction_id;
    end if;

    return null;
  end if;

  if new.transaction_id is not null then
    update public.transactions
    set amount = new.amount,
        occurred_on = new.occurred_on
    where id = new.transaction_id
      and (amount <> new.amount or occurred_on <> new.occurred_on);
  end if;

  return null;
end;
$$;

create trigger debt_entries_sync_transaction
  after update or delete on public.debt_entries
  for each row execute function public.sync_debt_entry_transaction();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_debt_update() from public, anon, authenticated;
revoke execute on function public.check_debt_entry() from public, anon, authenticated;
revoke execute on function public.check_debt_balance() from public, anon, authenticated;
revoke execute on function public.sync_debt_entry_transaction() from public, anon, authenticated;

-- RLS
alter table public.debts enable row level security;
alter table public.debt_entries enable row level security;

create policy "debts_select_own"
  on public.debts for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "debts_insert_own"
  on public.debts for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "debts_update_own"
  on public.debts for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Sin política delete: las deudas solo se archivan

create policy "debt_entries_select_own"
  on public.debt_entries for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "debt_entries_insert_own"
  on public.debt_entries for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "debt_entries_update_own"
  on public.debt_entries for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "debt_entries_delete_own"
  on public.debt_entries for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Saldo y ciclo de pago por deuda, en cualquier estado. Las fechas de ciclo
-- solo aplican a tarjetas y préstamos. Un día que no existe en el mes cae en
-- el último día del mes. Respeta RLS (security invoker).
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
           coalesce(sum(e.amount) filter (where e.kind = 'adjustment'), 0) as adjusted_total,
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

-- Registra un pago y, si se pide, su movimiento en una sola transacción:
-- gasto en "Deudas" para un préstamo o ingreso en "Cobros" para una cuenta
-- por cobrar. Los triggers de debt_entries validan estado, fecha y saldo.
create function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean
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
  v_entry_id uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id;

  if not found then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  if p_create_transaction then
    if v_debt.kind = 'credit_card' then
      raise exception 'Un pago de tarjeta no crea un movimiento'
        using errcode = 'check_violation';
    end if;

    v_type := case v_debt.kind when 'loan' then 'expense' else 'income' end;

    select id into v_category_id
    from public.categories
    where workspace_id is null
      and type = v_type
      and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, description
    ) values (
      v_debt.workspace_id,
      v_type,
      p_amount,
      v_category_id,
      p_occurred_on,
      case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_debt.name
    )
    returning id into v_transaction_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_note,
    v_transaction_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.debt_overview(uuid) from public, anon;
grant execute on function public.debt_overview(uuid) to authenticated;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean) to authenticated;
