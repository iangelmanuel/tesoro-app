-- Cuota de manejo automática de la tarjeta (SPEC 17). La cuota sube el saldo
-- de la tarjeta y nunca toca una cuenta ni crea movimiento. Un job diario la
-- genera; el cursor fee_charged_through evita regenerar una cuota borrada y
-- cobrar hacia atrás.
--   saldo tarjeta = opening_balance − Σ payment + Σ adjustment + Σ advance + Σ fee

alter table public.debts
  add column fee_amount numeric(14, 2) check (fee_amount > 0),
  add column fee_day smallint check (fee_day between 1 and 31),
  -- Último vencimiento ya procesado; evita regenerar una cuota borrada
  add column fee_charged_through date,
  add check ((fee_amount is null) = (fee_day is null)),
  add check (fee_amount is null or kind = 'credit_card');

alter table public.debt_entries
  add column generated boolean not null default false,
  add check (kind <> 'fee' or (transaction_id is null and account_id is null));

-- check_debt_entry (SPEC 06 y 16): fee solo en tarjetas, con amount > 0
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

  if new.kind = 'fee' and (v_kind <> 'credit_card' or new.amount <= 0) then
    raise exception 'Solo una tarjeta admite cuotas de manejo mayores a cero'
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

-- check_debt_balance, debt_overview y score_balances suman las cuotas
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
         + coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance', 'fee')), 0)
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

drop function public.debt_overview(uuid);

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
      on e.debt_id = c.id and e.kind = 'payment'
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

revoke execute on function public.debt_overview(uuid) from public, anon;
grant execute on function public.debt_overview(uuid) to authenticated;

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
           + coalesce(sum(e.amount) filter (where e.kind in ('adjustment', 'advance', 'fee')), 0) as balance
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

-- Cursor: nunca se cobra hacia atrás. La primera cuota es el primer fee_day
-- posterior a hoy (Bogotá).
create function public.debts_reset_fee_cursor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.fee_amount is null then
    new.fee_charged_through := null;
    return new;
  end if;

  if tg_op = 'INSERT'
    or new.fee_amount is distinct from old.fee_amount
    or new.fee_day is distinct from old.fee_day
    or (old.status in ('paid', 'archived') and new.status = 'active')
  then
    new.fee_charged_through := (now() at time zone 'America/Bogota')::date;
  end if;

  return new;
end;
$$;

create trigger debts_reset_fee_cursor
  before insert or update on public.debts
  for each row execute function public.debts_reset_fee_cursor();

-- Job: genera las cuotas vencidas de las tarjetas activas. security definer
-- porque inserta entradas de todos los espacios; solo lo ejecuta pg_cron.
create function public.charge_card_fees()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_card record;
  v_month date;
  v_due date;
begin
  for v_card in
    select id, workspace_id, fee_amount, fee_day, fee_charged_through
    from public.debts
    where kind = 'credit_card'
      and status = 'active'
      and fee_amount is not null
      and fee_charged_through is not null
  loop
    begin
      for v_month in
        select m::date
        from generate_series(
          date_trunc('month', v_card.fee_charged_through::timestamp),
          date_trunc('month', v_today::timestamp),
          interval '1 month'
        ) as m
      loop
        v_due := v_month
          + least(
              v_card.fee_day::int,
              extract(day from v_month + interval '1 month' - interval '1 day')::int
            )
          - 1;

        if v_due > v_card.fee_charged_through and v_due <= v_today then
          insert into public.debt_entries (
            workspace_id, debt_id, kind, amount, occurred_on, note, generated
          ) values (
            v_card.workspace_id, v_card.id, 'fee', v_card.fee_amount, v_due,
            'Cuota de manejo', true
          );
        end if;
      end loop;

      update public.debts
      set fee_charged_through = v_today
      where id = v_card.id;
    exception when others then
      -- Una falla en una tarjeta no detiene las demás; se reintenta mañana
      raise warning 'charge_card_fees: tarjeta % falló: %', v_card.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.charge_card_fees() from public, anon, authenticated;

-- 05:10 UTC = 00:10 America/Bogota
select cron.schedule(
  'charge-card-fees',
  '10 5 * * *',
  $$select public.charge_card_fees()$$
);
