-- Exportar a Excel y CSV (SPEC 32). Saldo de cada cuenta al inicio y al
-- cierre de cada mes del rango, con sus entradas y salidas del mes.
--
-- Mismo cálculo que account_balances / account_balance_at (SPEC 08c, 16,
-- 21): saldo inicial + movimientos + traspasos + ajustes + abonos y avances
-- de deudas + aportes a metas.
--
-- El saldo inicial con fecha (opening_balance_on) entra como una entrada (o
-- salida, si es negativo) de ese día; sin fecha aplica antes de cualquier
-- movimiento. Así inicio + entradas - salidas = cierre en todos los meses, y
-- el cierre coincide con account_balance_at(cuenta, último día del mes).
--
-- Solo cuentas existentes en el mes (creadas, en America/Bogota, a más tardar
-- el último día). Las archivadas salen si tuvieron saldo o movimientos en
-- algún mes del rango.
create function public.account_balances_by_month(
  p_workspace_id uuid,
  p_from date, -- primer día del primer mes
  p_to date -- último día del último mes
)
returns table (
  month date,
  account_id uuid,
  opening numeric,
  inflow numeric,
  outflow numeric,
  closing numeric
)
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
  accts as (
    select a.id, a.opening_balance, a.opening_balance_on, a.archived_at,
           a.created_at,
           (a.created_at at time zone 'America/Bogota')::date as created_on
    from public.accounts a
    where a.workspace_id = p_workspace_id
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
    select adj.account_id, adj.amount, adj.occurred_on
    from public.account_adjustments adj
    where adj.workspace_id = p_workspace_id
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
    union all
    -- Saldo inicial con fecha: un evento más de ese día
    select a.id, a.opening_balance, a.opening_balance_on
    from accts a
    where a.opening_balance_on is not null
  ),
  grid as (
    select m.month, m.month_end, a.id as account_id, a.archived_at,
           a.created_at,
           -- Saldo inicial sin fecha: aplica antes de todo
           case when a.opening_balance_on is null then a.opening_balance else 0 end as base
    from months m
    join accts a on a.created_on <= m.month_end
  ),
  balances as (
    select g.month, g.account_id, g.archived_at, g.created_at,
           g.base + coalesce(sum(d.delta) filter (where d.occurred_on < g.month), 0) as opening,
           coalesce(sum(d.delta) filter (
             where d.occurred_on >= g.month and d.delta > 0
           ), 0) as inflow,
           coalesce(-sum(d.delta) filter (
             where d.occurred_on >= g.month and d.delta < 0
           ), 0) as outflow,
           g.base + coalesce(sum(d.delta), 0) as closing
    from grid g
    left join deltas d
      on d.account_id = g.account_id
     and d.occurred_on <= g.month_end
    group by g.month, g.account_id, g.archived_at, g.created_at, g.base
  ),
  visible as (
    select b.account_id
    from balances b
    group by b.account_id
    having bool_or(b.archived_at is null)
        or bool_or(b.opening <> 0 or b.inflow <> 0 or b.outflow <> 0 or b.closing <> 0)
  )
  select b.month, b.account_id, b.opening, b.inflow, b.outflow, b.closing
  from balances b
  join visible v on v.account_id = b.account_id
  order by b.month, b.created_at, b.account_id;
$$;

revoke execute on function public.account_balances_by_month(uuid, date, date) from public, anon;
grant execute on function public.account_balances_by_month(uuid, date, date) to authenticated;
