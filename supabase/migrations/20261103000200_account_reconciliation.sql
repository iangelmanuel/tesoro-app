-- Conciliación de cuentas y fecha del saldo inicial (SPEC 21).
-- opening_balance_on nulo conserva el comportamiento anterior: el saldo
-- inicial aplica antes de cualquier movimiento. Con fecha, el saldo inicial
-- solo cuenta para saldos a esa fecha o posteriores; los movimientos
-- anteriores se suman igual.

alter table public.accounts
  add column opening_balance_on date;

-- account_balances (SPEC 08c) con opening_balance_on. Cambia el tipo de
-- retorno, por eso se recrea.
drop function public.account_balances(uuid);

create function public.account_balances(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  kind public.account_kind,
  icon text,
  color text,
  opening_balance numeric,
  opening_balance_on date,
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
         a.opening_balance, a.opening_balance_on, a.archived_at, a.created_at,
         a.updated_at,
         case
           when a.opening_balance_on is null or a.opening_balance_on <= td.value
             then a.opening_balance
           else 0
         end + coalesce(t.to_date, 0),
         a.opening_balance + coalesce(t.scheduled, 0),
         t.last_activity_on
  from public.accounts a
  cross join today td
  left join totals t on t.account_id = a.id
  where a.workspace_id = p_workspace_id
  order by a.created_at;
$$;

revoke execute on function public.account_balances(uuid) from public, anon;
grant execute on function public.account_balances(uuid) to authenticated;

-- Saldo de una cuenta a una fecha: mismas reglas que account_balances, con
-- todos los eventos con occurred_on <= p_on. Devuelve null si la cuenta no
-- existe o la RLS no la deja ver.
create function public.account_balance_at(
  p_account_id uuid,
  p_on date
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case
      when a.opening_balance_on is null or a.opening_balance_on <= p_on
        then a.opening_balance
      else 0
    end
    + coalesce((
      select sum(d.delta)
      from (
        select case t.type when 'income' then t.amount else -t.amount end as delta,
               t.occurred_on
        from public.transactions t
        where t.account_id = a.id
        union all
        select -tr.amount, tr.occurred_on
        from public.transfers tr
        where tr.from_account_id = a.id
        union all
        select tr.amount, tr.occurred_on
        from public.transfers tr
        where tr.to_account_id = a.id
        union all
        select adj.amount, adj.occurred_on
        from public.account_adjustments adj
        where adj.account_id = a.id
        union all
        select case e.kind when 'advance' then e.amount else -e.amount end,
               e.occurred_on
        from public.debt_entries e
        where e.account_id = a.id
        union all
        select -c.amount, c.occurred_on
        from public.goal_contributions c
        where c.account_id = a.id
      ) d
      where d.occurred_on <= p_on
    ), 0)
  from public.accounts a
  where a.id = p_account_id;
$$;

revoke execute on function public.account_balance_at(uuid, date) from public, anon;
grant execute on function public.account_balance_at(uuid, date) to authenticated;
