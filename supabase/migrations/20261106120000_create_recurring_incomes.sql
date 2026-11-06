-- Ingresos fijos (SPEC 30). Solo en Personal. Las ocurrencias no se
-- guardan: las calcula recurring_income_occurrences. Recibir una ocurrencia
-- es un ingreso enlazado por recurring_income_id + recurring_income_due_on.
-- Las fuentes "none" (proyectos, inversiones) no tienen calendario: sus
-- ingresos se enlazan a la fuente con recurring_income_due_on en null.

create type public.income_frequency as enum ('monthly', 'biweekly', 'yearly', 'none');

create table public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),         -- monto esperado
  category_id uuid not null references public.categories (id) on delete no action,
  account_id uuid references public.accounts (id) on delete set null, -- cuenta por defecto
  frequency public.income_frequency not null,
  day_of_month smallint check (day_of_month between 1 and 31),
  second_day_of_month smallint check (second_day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((frequency = 'none') = (day_of_month is null)),
  check ((frequency = 'biweekly') = (second_day_of_month is not null)),
  check ((frequency = 'yearly') = (month_of_year is not null)),
  check (second_day_of_month is null or second_day_of_month > day_of_month),
  check (ends_on is null or ends_on >= starts_on)
);

create index recurring_incomes_workspace on public.recurring_incomes (workspace_id);

alter table public.transactions
  add column recurring_income_id uuid
    references public.recurring_incomes (id) on delete set null,
  add column recurring_income_due_on date,
  -- Un movimiento paga un gasto fijo o recibe un ingreso fijo, no ambos
  add constraint transactions_one_recurring_link_check
    check (recurring_expense_id is null or recurring_income_id is null);

create index transactions_recurring_income
  on public.transactions (recurring_income_id)
  where recurring_income_id is not null;

-- Una ocurrencia se recibe una sola vez; sin ocurrencia, ilimitados
create unique index transactions_recurring_income_occurrence
  on public.transactions (recurring_income_id, recurring_income_due_on)
  where recurring_income_due_on is not null;

grant select, insert, update, delete on public.recurring_incomes
  to authenticated;

-- ¿p_date es una fecha de vencimiento de un ingreso fijo con este
-- calendario? Un día que no existe en el mes cae en el último día del mes.
create function public.is_recurring_income_due_date(
  p_frequency public.income_frequency,
  p_day_of_month smallint,
  p_second_day_of_month smallint,
  p_month_of_year smallint,
  p_starts_on date,
  p_ends_on date,
  p_date date
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  with d as (
    select extract(day from p_date)::int as day,
           extract(month from p_date)::int as month,
           extract(
             day from date_trunc('month', p_date::timestamp)
               + interval '1 month' - interval '1 day'
           )::int as last_day
  )
  select coalesce(
    p_frequency <> 'none'
    and p_date >= p_starts_on
    and (p_ends_on is null or p_date <= p_ends_on)
    and (p_frequency <> 'yearly' or d.month = p_month_of_year)
    and (
      d.day = least(p_day_of_month::int, d.last_day)
      or (
        p_frequency = 'biweekly'
        and d.day = least(p_second_day_of_month::int, d.last_day)
      )
    ),
    false
  )
  from d;
$$;

-- Triggers
create trigger recurring_incomes_set_updated_at
  before update on public.recurring_incomes
  for each row execute function public.set_updated_at();

-- El espacio es Personal; la categoría es de ingreso y del sistema o del
-- mismo espacio; la cuenta, si llega, es del mismo espacio
create function public.check_recurring_income()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.workspaces
    where id = new.workspace_id and type = 'personal'
  ) then
    raise exception 'Los ingresos fijos solo existen en el espacio Personal'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.categories
    where id = new.category_id
      and type = 'income'
      and (workspace_id is null or workspace_id = new.workspace_id)
  ) then
    raise exception 'La categoría debe ser de ingreso y del mismo espacio'
      using errcode = 'check_violation';
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.accounts
    where id = new.account_id and workspace_id = new.workspace_id
  ) then
    raise exception 'La cuenta debe ser del mismo espacio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recurring_incomes_check
  before insert or update on public.recurring_incomes
  for each row execute function public.check_recurring_income();

-- El enlace a un ingreso fijo exige tipo ingreso y el mismo espacio. Sin
-- enlace, limpia la fecha (cubre el on delete set null). La fecha debe ser
-- null en fuentes "none" y una fecha de vencimiento real en las demás. Si
-- el enlace no cambia al editar, no se revalida la fecha: el ingreso fijo
-- pudo cambiar de días después de recibir la ocurrencia.
create function public.check_transaction_recurring_income()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_income public.recurring_incomes;
begin
  if new.recurring_income_id is null then
    new.recurring_income_due_on = null;
    return new;
  end if;

  select * into v_income
  from public.recurring_incomes
  where id = new.recurring_income_id
    and workspace_id = new.workspace_id;

  if not found or new.type <> 'income' then
    raise exception 'El ingreso no corresponde a un ingreso fijo de este espacio'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE'
    and new.recurring_income_id = old.recurring_income_id
    and new.recurring_income_due_on is not distinct from old.recurring_income_due_on
  then
    return new;
  end if;

  if v_income.frequency = 'none' then
    if new.recurring_income_due_on is not null then
      raise exception 'Un ingreso sin fecha fija no tiene ocurrencias'
        using errcode = 'check_violation';
    end if;
  elsif new.recurring_income_due_on is null
    or not public.is_recurring_income_due_date(
      v_income.frequency,
      v_income.day_of_month,
      v_income.second_day_of_month,
      v_income.month_of_year,
      v_income.starts_on,
      v_income.ends_on,
      new.recurring_income_due_on
    )
  then
    raise exception 'La fecha no es una ocurrencia de este ingreso fijo'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger transactions_check_recurring_income
  before insert or update on public.transactions
  for each row execute function public.check_transaction_recurring_income();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_recurring_income() from public, anon, authenticated;
revoke execute on function public.check_transaction_recurring_income() from public, anon, authenticated;
-- La usa el trigger de transactions, que corre como el usuario
revoke execute on function public.is_recurring_income_due_date(public.income_frequency, smallint, smallint, smallint, date, date, date) from public, anon;
grant execute on function public.is_recurring_income_due_date(public.income_frequency, smallint, smallint, smallint, date, date, date) to authenticated;

-- RLS
alter table public.recurring_incomes enable row level security;

create policy "recurring_incomes_select_own"
  on public.recurring_incomes for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "recurring_incomes_insert_own"
  on public.recurring_incomes for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

create policy "recurring_incomes_update_own"
  on public.recurring_incomes for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

create policy "recurring_incomes_delete_own"
  on public.recurring_incomes for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Ocurrencias de los ingresos fijos activos con calendario en
-- [p_from, p_to], con su ingreso. Misma forma que recurring_occurrences.
-- Incluye también las ocurrencias recibidas en el rango cuya fecha ya no
-- calza con el calendario actual (el ingreso fijo cambió de días).
create function public.recurring_income_occurrences(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  recurring_income_id uuid,
  name text,
  amount numeric,
  category_id uuid,
  account_id uuid,
  due_on date,
  transaction_id uuid,
  received_amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with incomes as (
    select r.*,
           greatest(p_from, r.starts_on) as range_from,
           least(p_to, coalesce(r.ends_on, p_to)) as range_to
    from public.recurring_incomes r
    where r.workspace_id = p_workspace_id
      and r.is_active
      and r.frequency <> 'none'
  ),
  occurrences as (
    select distinct
           i.id, i.name, i.amount, i.category_id, i.account_id,
           i.range_from, i.range_to,
           (
             m.month::date
             + least(
                 d.day::int,
                 extract(day from m.month + interval '1 month' - interval '1 day')::int
               )
             - 1
           ) as due_on
    from incomes i
    cross join lateral generate_series(
      date_trunc('month', i.range_from::timestamp),
      date_trunc('month', i.range_to::timestamp),
      interval '1 month'
    ) as m (month)
    cross join lateral unnest(
      array[i.day_of_month, i.second_day_of_month]
    ) as d (day)
    where d.day is not null
      and (i.frequency <> 'yearly' or extract(month from m.month) = i.month_of_year)
  ),
  scheduled as (
    select o.id, o.name, o.amount, o.category_id, o.account_id, o.due_on,
           t.id as transaction_id, t.amount as received_amount
    from occurrences o
    left join public.transactions t
      on t.recurring_income_id = o.id
      and t.recurring_income_due_on = o.due_on
    where o.due_on between o.range_from and o.range_to
  ),
  orphans as (
    select i.id, i.name, i.amount, i.category_id, i.account_id,
           t.recurring_income_due_on, t.id, t.amount
    from incomes i
    join public.transactions t
      on t.recurring_income_id = i.id
      and t.recurring_income_due_on between p_from and p_to
    where not exists (
      select 1 from scheduled s
      where s.id = i.id and s.due_on = t.recurring_income_due_on
    )
  )
  select * from scheduled
  union all
  select * from orphans
  order by 6, 2;
$$;

revoke execute on function public.recurring_income_occurrences(uuid, date, date) from public, anon;
grant execute on function public.recurring_income_occurrences(uuid, date, date) to authenticated;
