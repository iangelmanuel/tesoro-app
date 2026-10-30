-- Funciones de agregación para Resumen y Reportes (SPEC 03).
-- Todas son security invoker: RLS de transactions y categories filtra las
-- filas. Con un workspace ajeno devuelven ceros o vacío.

-- Totales por mes, con meses sin movimientos en cero
create function public.monthly_totals(
  p_workspace_id uuid,
  p_from date,   -- primer día de un mes
  p_to date      -- cualquier día del último mes, inclusive
)
returns table (month date, income numeric, expense numeric, tx_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.month::date,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    count(t.id)
  from generate_series(
    date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month'
  ) as m (month)
  left join public.transactions t
    on t.workspace_id = p_workspace_id
    and t.occurred_on >= m.month
    and t.occurred_on < m.month + interval '1 month'
  group by m.month
  order by m.month;
$$;

-- Totales por categoría en un rango de fechas inclusivo
create function public.category_totals(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_type public.transaction_type
)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  archived boolean,
  total numeric,
  tx_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.icon, c.color, c.archived_at is not null,
         sum(t.amount), count(t.id)
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace_id
    and t.type = p_type
    and t.occurred_on between p_from and p_to
  group by c.id
  order by sum(t.amount) desc;
$$;

-- Balance acumulado histórico (todos los ingresos − todos los gastos)
create function public.workspace_balance(p_workspace_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when type = 'income' then amount else -amount end), 0)
  from public.transactions
  where workspace_id = p_workspace_id;
$$;

revoke execute on function public.monthly_totals(uuid, date, date) from public, anon;
grant execute on function public.monthly_totals(uuid, date, date) to authenticated;

revoke execute on function public.category_totals(uuid, date, date, public.transaction_type) from public, anon;
grant execute on function public.category_totals(uuid, date, date, public.transaction_type) to authenticated;

revoke execute on function public.workspace_balance(uuid) from public, anon;
grant execute on function public.workspace_balance(uuid) to authenticated;
