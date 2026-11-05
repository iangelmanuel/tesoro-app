-- Abonos extra a tarjetas y préstamos (SPEC 26). Un abono es un pago
-- (kind = 'payment') que baja el saldo igual que cualquier pago, pero no
-- cuenta para cubrir el pago mínimo o la cuota del ciclo: debt_overview lo
-- excluye de paid_current_cycle y paid_previous_cycle.

alter table public.debt_entries
  add column is_extra_payment boolean not null default false;

alter table public.debt_entries
  add constraint debt_entries_extra_payment_check
  check (not is_extra_payment or kind = 'payment');

comment on column public.debt_entries.is_extra_payment is
  'Abono extra: baja el saldo pero no cubre el pago mínimo o la cuota del ciclo';

-- record_debt_payment gana p_is_extra_payment. Solo tarjetas y préstamos
-- tienen ciclo de pago: en una cuenta por cobrar el abono no aplica.
drop function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time);

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
  p_is_extra_payment boolean default false
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
    transaction_id, account_id, is_extra_payment
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
    p_is_extra_payment
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean) to authenticated;

-- debt_overview: igual que en SPEC 17, salvo que el ciclo solo suma pagos que
-- no son abonos extra. El saldo y paid_total siguen contando todos los pagos.
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
         cp.paid_previous_cycle
  from public.debts d
  left join totals t on t.debt_id = d.id
  left join cycles c on c.id = d.id
  left join cycle_paid cp on cp.id = d.id
  where d.workspace_id = p_workspace_id
  order by d.created_at;
$$;
