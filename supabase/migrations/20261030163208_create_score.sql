-- Score financiero y recomendaciones (SPEC 07). El score no se guarda: se
-- calcula al vuelo en TS con los insumos de estas funciones. Solo se guarda
-- qué recomendaciones ocultó el usuario y en qué mes.

create table public.dismissed_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  rule text not null check (rule in (
    'deficit', 'category_growth', 'budget_exceeded', 'goal_at_risk',
    'high_utilization', 'highest_rate_first', 'overdue_payment',
    'low_cushion', 'unbudgeted_spending', 'irregular_records'
  )),
  entity_key text not null check (char_length(entity_key) between 1 and 100),
  month date not null check (extract(day from month) = 1), -- mes en que se ocultó
  created_at timestamptz not null default now(),
  unique (workspace_id, rule, entity_key, month)
);

-- RLS
alter table public.dismissed_recommendations enable row level security;

create policy "dismissed_recommendations_select_own"
  on public.dismissed_recommendations for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "dismissed_recommendations_insert_own"
  on public.dismissed_recommendations for insert
  to authenticated
  with check (public.is_workspace_owner(workspace_id));

-- Sin política update: ocultar inserta y mostrar de nuevo borra

create policy "dismissed_recommendations_delete_own"
  on public.dismissed_recommendations for delete
  to authenticated
  using (public.is_workspace_owner(workspace_id));

-- Insumos por mes en [p_from, p_to] (primeros días de mes, inclusivos), con
-- ceros en los meses sin datos. closing_balance es ingresos − gastos de toda
-- la historia hasta el fin del mes.
create function public.score_monthly_inputs(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (
  month date,
  income numeric,
  expense numeric,
  closing_balance numeric,
  budgeted_count int,
  within_budget_count int
)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select m.month::date as month
    from generate_series(
      date_trunc('month', p_from::timestamp),
      date_trunc('month', p_to::timestamp),
      interval '1 month'
    ) as m (month)
  ),
  totals as (
    select m.month,
           coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
           coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
    from months m
    left join public.transactions t
      on t.workspace_id = p_workspace_id
      and t.occurred_on >= m.month
      and t.occurred_on < m.month + interval '1 month'
    group by m.month
  ),
  prior as (
    select coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0) as balance
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.occurred_on < date_trunc('month', p_from::timestamp)
  ),
  budget_counts as (
    select b.month,
           count(*)::int as budgeted_count,
           count(*) filter (where coalesce(s.spent, 0) <= b.amount)::int as within_budget_count
    from public.budgets b
    left join lateral (
      select sum(t.amount) as spent
      from public.transactions t
      where t.workspace_id = b.workspace_id
        and t.type = 'expense'
        and t.category_id = b.category_id
        and t.occurred_on >= b.month
        and t.occurred_on < b.month + interval '1 month'
    ) s on true
    where b.workspace_id = p_workspace_id
      and b.month between date_trunc('month', p_from::timestamp) and date_trunc('month', p_to::timestamp)
    group by b.month
  )
  select t.month, t.income, t.expense,
         p.balance + sum(t.income - t.expense) over (order by t.month),
         coalesce(bc.budgeted_count, 0),
         coalesce(bc.within_budget_count, 0)
  from totals t
  cross join prior p
  left join budget_counts bc on bc.month = t.month
  order by t.month;
$$;

-- Semanas ISO (lunes) con al menos un movimiento en [p_from, fin de p_to] y
-- hasta hoy (America/Bogota)
create function public.score_weekly_activity(
  p_workspace_id uuid,
  p_from date,
  p_to date
)
returns table (week_start date, tx_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select date_trunc('week', t.occurred_on::timestamp)::date, count(*)
  from public.transactions t
  where t.workspace_id = p_workspace_id
    and t.occurred_on >= date_trunc('month', p_from::timestamp)
    and t.occurred_on < date_trunc('month', p_to::timestamp) + interval '1 month'
    and t.occurred_on <= (now() at time zone 'America/Bogota')::date
  group by 1
  order by 1;
$$;

-- Saldo de cada tarjeta y préstamo, y lo ahorrado en cada meta, al fin de
-- cada mes en [p_from, p_to]. Una deuda solo aparece desde el mes en que se
-- creó. Las cuentas por cobrar no entran.
create function public.score_balances(
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
           + coalesce(sum(e.amount) filter (where e.kind = 'adjustment'), 0) as balance
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

revoke execute on function public.score_monthly_inputs(uuid, date, date) from public, anon;
grant execute on function public.score_monthly_inputs(uuid, date, date) to authenticated;

revoke execute on function public.score_weekly_activity(uuid, date, date) from public, anon;
grant execute on function public.score_weekly_activity(uuid, date, date) to authenticated;

revoke execute on function public.score_balances(uuid, date, date) from public, anon;
grant execute on function public.score_balances(uuid, date, date) to authenticated;
