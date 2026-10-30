-- Gastos fijos recurrentes y presupuestos mensuales por categoría (SPEC 04).
-- Las ocurrencias de un gasto fijo no se guardan: las calcula
-- recurring_occurrences. Un pago es un movimiento enlazado por
-- recurring_expense_id + recurring_due_on.

create type public.recurring_frequency as enum ('monthly', 'yearly');

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  frequency public.recurring_frequency not null,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12), -- solo yearly
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((frequency = 'yearly') = (month_of_year is not null)),
  check (ends_on is null or ends_on >= starts_on)
);

create index recurring_expenses_workspace on public.recurring_expenses (workspace_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  month date not null check (extract(day from month) = 1), -- primer día del mes
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category_id, month)
);

alter table public.transactions
  add column recurring_expense_id uuid
    references public.recurring_expenses (id) on delete set null,
  add column recurring_due_on date;

-- Una ocurrencia se paga una sola vez
create unique index transactions_recurring_occurrence
  on public.transactions (recurring_expense_id, recurring_due_on)
  where recurring_expense_id is not null;

-- Triggers
create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- La categoría debe ser de gasto y del sistema o del mismo espacio, aunque
-- el cliente se salte la validación. La usan recurring_expenses y budgets.
create function public.check_expense_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.categories
    where id = new.category_id
      and type = 'expense'
      and (workspace_id is null or workspace_id = new.workspace_id)
  ) then
    raise exception 'La categoría debe ser de gasto y del mismo espacio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger recurring_expenses_check_category
  before insert or update on public.recurring_expenses
  for each row execute function public.check_expense_category();

create trigger budgets_check_category
  before insert or update on public.budgets
  for each row execute function public.check_expense_category();

-- El enlace a un gasto fijo exige fecha de vencimiento, tipo gasto y el
-- mismo espacio. Sin enlace, limpia la fecha (cubre el on delete set null).
create function public.check_transaction_recurring()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.recurring_expense_id is null then
    new.recurring_due_on = null;
    return new;
  end if;

  if new.recurring_due_on is null
    or new.type <> 'expense'
    or not exists (
      select 1 from public.recurring_expenses
      where id = new.recurring_expense_id
        and workspace_id = new.workspace_id
    )
  then
    raise exception 'El pago no corresponde a un gasto fijo de este espacio'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger transactions_check_recurring
  before insert or update on public.transactions
  for each row execute function public.check_transaction_recurring();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_expense_category() from public, anon, authenticated;
revoke execute on function public.check_transaction_recurring() from public, anon, authenticated;

-- RLS
alter table public.recurring_expenses enable row level security;
alter table public.budgets enable row level security;

create policy "recurring_expenses_select_own"
  on public.recurring_expenses for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "recurring_expenses_insert_own"
  on public.recurring_expenses for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "recurring_expenses_update_own"
  on public.recurring_expenses for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "recurring_expenses_delete_own"
  on public.recurring_expenses for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "budgets_select_own"
  on public.budgets for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "budgets_insert_own"
  on public.budgets for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "budgets_update_own"
  on public.budgets for update
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "budgets_delete_own"
  on public.budgets for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Ocurrencias de los gastos fijos activos en [p_from, p_to], con su pago.
-- Un día que no existe en el mes cae en el último día del mes.
create function public.recurring_occurrences(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  recurring_expense_id uuid,
  name text,
  amount numeric,
  category_id uuid,
  due_on date,
  transaction_id uuid,
  paid_amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with expenses as (
    select r.*,
           greatest(p_from, r.starts_on) as range_from,
           least(p_to, coalesce(r.ends_on, p_to)) as range_to
    from public.recurring_expenses r
    where r.workspace_id = p_workspace_id
      and r.is_active
  ),
  occurrences as (
    select e.id, e.name, e.amount, e.category_id, e.range_from, e.range_to,
           (
             m.month::date
             + least(
                 e.day_of_month::int,
                 extract(day from m.month + interval '1 month' - interval '1 day')::int
               )
             - 1
           ) as due_on
    from expenses e
    cross join lateral generate_series(
      date_trunc('month', e.range_from::timestamp),
      date_trunc('month', e.range_to::timestamp),
      interval '1 month'
    ) as m (month)
    where e.frequency = 'monthly'
      or extract(month from m.month) = e.month_of_year
  )
  select o.id, o.name, o.amount, o.category_id, o.due_on, t.id, t.amount
  from occurrences o
  left join public.transactions t
    on t.recurring_expense_id = o.id
    and t.recurring_due_on = o.due_on
  where o.due_on between o.range_from and o.range_to
  order by o.due_on, o.name;
$$;

-- Presupuestado, gastado y comprometido por categoría en el mes de p_month.
-- Incluye las categorías de gasto con movimientos y sin presupuesto
-- (budget_id y budget_amount en null).
create function public.budget_progress(p_workspace_id uuid, p_month date)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  archived boolean,
  budget_id uuid,
  budget_amount numeric,
  spent numeric,
  committed numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select date_trunc('month', p_month::timestamp)::date as month_start,
           (date_trunc('month', p_month::timestamp) + interval '1 month' - interval '1 day')::date as month_end
  ),
  month_budgets as (
    select b.id, b.category_id, b.amount
    from public.budgets b, bounds
    where b.workspace_id = p_workspace_id
      and b.month = bounds.month_start
  ),
  month_spent as (
    select t.category_id, sum(t.amount) as total
    from public.transactions t, bounds
    where t.workspace_id = p_workspace_id
      and t.type = 'expense'
      and t.occurred_on between bounds.month_start and bounds.month_end
    group by t.category_id
  ),
  month_committed as (
    select o.category_id, sum(o.amount) as total
    from bounds,
         public.recurring_occurrences(p_workspace_id, bounds.month_start, bounds.month_end) o
    where o.transaction_id is null
    group by o.category_id
  ),
  keys as (
    select category_id from month_budgets
    union
    select category_id from month_spent
  )
  select c.id, c.name, c.icon, c.color, c.archived_at is not null,
         b.id, b.amount,
         coalesce(s.total, 0), coalesce(co.total, 0)
  from keys k
  join public.categories c on c.id = k.category_id
  left join month_budgets b on b.category_id = k.category_id
  left join month_spent s on s.category_id = k.category_id
  left join month_committed co on co.category_id = k.category_id
  order by b.id is null, c.name;
$$;

revoke execute on function public.recurring_occurrences(uuid, date, date) from public, anon;
grant execute on function public.recurring_occurrences(uuid, date, date) to authenticated;

revoke execute on function public.budget_progress(uuid, date) from public, anon;
grant execute on function public.budget_progress(uuid, date) to authenticated;
