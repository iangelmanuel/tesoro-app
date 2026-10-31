-- Empresa: flujo de caja, reportes, score y recomendaciones (SPEC 11). Sin
-- tablas nuevas: el score se calcula al vuelo en TS, como el de Personal.

-- Nuevas claves de regla de Empresa (irregular_records se comparte)
alter table public.dismissed_recommendations
  drop constraint dismissed_recommendations_rule_check,
  add constraint dismissed_recommendations_rule_check check (rule in (
    -- Personal (SPEC 07)
    'deficit', 'category_growth', 'budget_exceeded', 'goal_at_risk',
    'high_utilization', 'highest_rate_first', 'overdue_payment',
    'low_cushion', 'unbudgeted_spending', 'irregular_records',
    -- Empresa (SPEC 11)
    'loss_month', 'negative_account', 'low_liquidity', 'sales_drop',
    'low_margin', 'cost_growth', 'client_concentration',
    'cost_concentration', 'missing_accounts'
  ));

-- Escrituras: dueño y sin marca de borrado, como el resto de tablas del
-- espacio. La política select no cambia
drop policy "dismissed_recommendations_insert_own" on public.dismissed_recommendations;
create policy "dismissed_recommendations_insert_own"
  on public.dismissed_recommendations for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

drop policy "dismissed_recommendations_delete_own" on public.dismissed_recommendations;
create policy "dismissed_recommendations_delete_own"
  on public.dismissed_recommendations for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Saldo en cuentas al fin de cada mes en [p_from, p_to] (primeros días de
-- mes, inclusivos). Suma solo las cuentas activas hoy, para coincidir con
-- "Saldo en cuentas" de la página Cuentas. El saldo inicial cuenta desde el
-- mes de creación de la cuenta (America/Bogota). Mismas reglas de deltas que
-- account_balances. Respeta RLS (security invoker).
create function public.account_monthly_balances(
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

revoke execute on function public.account_monthly_balances(uuid, date, date) from public, anon;
grant execute on function public.account_monthly_balances(uuid, date, date) to authenticated;

-- Totales por contraparte en [p_from, p_to] para un tipo de movimiento. Agrupa
-- sin distinguir mayúsculas ni espacios en los extremos y devuelve como nombre
-- el primer valor original. Respeta RLS (security invoker).
create function public.counterparty_totals(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_type public.transaction_type
)
returns table (counterparty text, total numeric, tx_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select min(t.counterparty) as counterparty,
         sum(t.amount) as total,
         count(*) as tx_count
  from public.transactions t
  where t.workspace_id = p_workspace_id
    and t.type = p_type
    and t.occurred_on >= p_from
    and t.occurred_on <= p_to
    and t.counterparty is not null
  group by lower(btrim(t.counterparty))
  order by total desc;
$$;

revoke execute on function public.counterparty_totals(uuid, date, date, public.transaction_type) from public, anon;
grant execute on function public.counterparty_totals(uuid, date, date, public.transaction_type) to authenticated;
