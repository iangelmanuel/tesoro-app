-- SPEC 42, parte 2: compras y avances de tarjeta a cuotas, editar avances y
-- convertir ajustes positivos de tarjeta en compra, avance o cuota de manejo.
--
-- Una compra o avance (kind = 'advance') a N cuotas aporta monto / N al pago
-- de cada uno de los N ciclos de pago siguientes a su fecha. El pago del mes
-- de la tarjeta pasa a ser max(pago mínimo, Σ cuotas del ciclo); lo calcula
-- la app con installments_due_current / _previous de debt_overview. Sin
-- compras a cuotas todo sigue igual.

-- 1. Columna -------------------------------------------------------------------

-- null = sin cuotas (no cambia el pago del mes). Solo compras y avances; que
-- la deuda sea una tarjeta lo exige check_debt_entry (un avance solo existe
-- en tarjetas)
alter table public.debt_entries
  add column installments smallint,
  add constraint debt_entries_installments_range
    check (installments between 1 and 48),
  add constraint debt_entries_installments_advance
    check (installments is null or kind = 'advance');

-- Movimiento enlazado: el check de SPEC 06 solo lo permitía en pagos, así que
-- el avance con ingreso de SPEC 36 nunca se pudo guardar (record_card_advance
-- con cuenta fallaba y su migración de datos no convirtió ningún avance). Un
-- avance también puede llevar movimiento
alter table public.debt_entries
  drop constraint debt_entries_check1,
  add constraint debt_entries_transaction_kind
    check (kind in ('payment', 'advance') or transaction_id is null);

-- 2. check_debt_entry ----------------------------------------------------------

-- Misma función de la parte 1 (20261117130000). Cambia:
-- - un ajuste que subió el saldo puede pasar a compra o avance (advance) o a
--   cuota de manejo (fee) con el mismo monto: el saldo no cambia;
-- - cambiar las cuotas exige la deuda activa, como cualquier otro campo.
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
    if new.debt_id <> old.debt_id then
      raise exception 'Una entrada no puede cambiar de deuda ni de tipo'
        using errcode = 'check_violation';
    end if;

    -- Convertir un ajuste (SPEC 42): el que bajó el saldo pasa a pago con el
    -- monto en positivo; el que lo subió, a compra o avance o a cuota de
    -- manejo con el mismo monto. En ambos casos el saldo no cambia
    if new.kind <> old.kind and not (
      old.kind = 'adjustment'
      and (
        (new.kind = 'payment' and old.amount < 0 and new.amount = -old.amount)
        or (
          new.kind in ('advance', 'fee')
          and old.amount > 0
          and new.amount = old.amount
        )
      )
    ) then
      raise exception 'Una entrada no puede cambiar de deuda ni de tipo'
        using errcode = 'check_violation';
    end if;

    -- Solo cambian hora u orden del día: no afecta el saldo
    if new.kind = old.kind
      and new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.transaction_id is not distinct from old.transaction_id
      and new.account_id is not distinct from old.account_id
      and new.installments is not distinct from old.installments
    then
      return new;
    end if;

    -- Quitar el enlace al borrar el movimiento (on delete set null) se
    -- permite aunque la deuda no esté activa: no cambia el saldo
    if new.kind = old.kind
      and new.transaction_id is null
      and old.transaction_id is not null
      and new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.installments is not distinct from old.installments
    then
      return new;
    end if;
  end if;

  select kind, status
    into v_kind, v_status
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

  -- En préstamos, cuentas por cobrar y avances la cuenta va en el movimiento
  if new.account_id is not null
    and (new.kind <> 'payment' or v_kind <> 'credit_card')
  then
    raise exception 'Solo los pagos de una tarjeta llevan cuenta'
      using errcode = 'check_violation';
  end if;

  if new.transaction_id is not null and not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id
      and t.workspace_id = new.workspace_id
      and (
        (v_kind = 'loan' and t.type = 'expense')
        or (v_kind = 'receivable' and t.type = 'income')
        or (v_kind = 'credit_card' and new.kind = 'advance' and t.type = 'income')
      )
  ) then
    raise exception 'El movimiento no corresponde a esta deuda'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_debt_entry() from public, anon, authenticated;

-- 3. Primer ciclo de una compra a cuotas ---------------------------------------

-- Mes (primer día) del vencimiento en el que se paga la primera cuota de una
-- compra o avance del día p_occurred_on:
-- - con día de corte, el primer vencimiento posterior al primer corte que
--   incluye la compra (corte ≥ fecha de la compra);
-- - sin día de corte, el primer vencimiento posterior a la compra (el ciclo
--   del día de pago, igual que paid_current_cycle).
-- Los días 29 a 31 caen en el último día de los meses cortos. Misma regla en
-- installmentStartMonth (src/features/debts/installments.ts).
create function public.card_installment_start(
  p_occurred_on date,
  p_due_day smallint,
  p_closing_day smallint
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_occurred_on::timestamp)::date;
  v_after date := p_occurred_on;
begin
  if p_closing_day is not null then
    -- Corte del mes de la compra; si ya pasó, el del mes siguiente
    if v_month + least(
         p_closing_day::int,
         extract(day from v_month + interval '1 month' - interval '1 day')::int
       ) - 1 < p_occurred_on
    then
      v_month := (v_month + interval '1 month')::date;
    end if;

    v_after := v_month + least(
      p_closing_day::int,
      extract(day from v_month + interval '1 month' - interval '1 day')::int
    ) - 1;
  end if;

  -- Primer vencimiento estrictamente posterior a v_after
  if v_month + least(
       p_due_day::int,
       extract(day from v_month + interval '1 month' - interval '1 day')::int
     ) - 1 <= v_after
  then
    v_month := (v_month + interval '1 month')::date;
  end if;

  return v_month;
end;
$$;

revoke execute on function public.card_installment_start(date, smallint, smallint) from public, anon;
grant execute on function public.card_installment_start(date, smallint, smallint) to authenticated;

-- 4. debt_overview con las cuotas del ciclo -----------------------------------

-- Misma consulta de SPEC 41 con dos columnas al final:
-- - installments_due_current: Σ monto / N de las compras y avances a cuotas
--   cuyo rango de N ciclos cubre el próximo vencimiento (next_due_on);
-- - installments_due_previous: lo mismo para el vencimiento anterior
--   (prev_due_on).
-- null fuera de las tarjetas. Cambia el tipo de retorno: hay que recrearla.
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
  paid_previous_cycle numeric,
  schedule public.receivable_schedule,
  starts_on date,
  account_id uuid,
  installments_due_current numeric,
  installments_due_previous numeric
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
    select d.id, d.kind, d.due_day, d.closing_day, t.value as today,
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
  -- k = ciclos entre el de la primera cuota y el del próximo vencimiento: la
  -- compra aporta al próximo si 0 ≤ k < N y al anterior si 0 ≤ k − 1 < N
  installment_cycles as (
    select n.id,
           round(e.amount / e.installments, 2) as share,
           e.installments,
           (extract(year from n.next_month)::int * 12
              + extract(month from n.next_month)::int)
           - (extract(year from s.start_month)::int * 12
              + extract(month from s.start_month)::int) as k
    from next_months n
    join public.debt_entries e
      on e.debt_id = n.id
     and e.kind = 'advance'
     and e.installments is not null
    cross join lateral (
      select public.card_installment_start(
        e.occurred_on, n.due_day, n.closing_day
      ) as start_month
    ) s
    where n.kind = 'credit_card'
  ),
  installments_due as (
    select i.id,
           coalesce(sum(i.share) filter (
             where i.k >= 0 and i.k < i.installments
           ), 0) as due_current,
           coalesce(sum(i.share) filter (
             where i.k - 1 >= 0 and i.k - 1 < i.installments
           ), 0) as due_previous
    from installment_cycles i
    group by i.id
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
         cp.paid_previous_cycle,
         d.schedule,
         d.starts_on,
         d.account_id,
         case when d.kind = 'credit_card' then coalesce(i.due_current, 0) end,
         case when d.kind = 'credit_card' then coalesce(i.due_previous, 0) end
  from public.debts d
  left join totals t on t.debt_id = d.id
  left join cycles c on c.id = d.id
  left join cycle_paid cp on cp.id = d.id
  left join installments_due i on i.id = d.id
  where d.workspace_id = p_workspace_id
  order by d.created_at;
$$;

revoke execute on function public.debt_overview(uuid) from public, anon;
grant execute on function public.debt_overview(uuid) to authenticated;

-- 5. record_card_advance con cuotas -------------------------------------------

-- Misma función de SPEC 36 con p_installments al final (default null: el MCP
-- y las llamadas existentes no cambian). Cambia la firma: hay que recrearla.
drop function public.record_card_advance(uuid, numeric, date, text, uuid, time);

create function public.record_card_advance(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_account_id uuid default null,
  p_occurred_time time default null,
  p_installments smallint default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
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

  if v_debt.kind <> 'credit_card' then
    raise exception 'Solo una tarjeta admite avances'
      using errcode = 'check_violation';
  end if;

  if p_account_id is not null then
    select id into v_category_id
    from public.categories
    where workspace_id is null
      and scope = 'personal'
      and type = 'income'
      and name = 'Avance de tarjeta';

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, occurred_time,
      description, account_id
    ) values (
      v_debt.workspace_id,
      'income',
      p_amount,
      v_category_id,
      p_occurred_on,
      p_occurred_time,
      'Avance ' || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, occurred_time, note,
    transaction_id, installments
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'advance',
    p_amount,
    p_occurred_on,
    p_occurred_time,
    p_note,
    v_transaction_id,
    p_installments
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time, smallint) from public, anon;
grant execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time, smallint) to authenticated;

-- 6. update_card_advance -------------------------------------------------------

-- Edita una compra o avance de tarjeta en una sola transacción: monto, fecha,
-- hora, nota, cuotas y cuenta. La cuenta decide qué es:
-- - con cuenta y movimiento: se cambia la cuenta (y descripción, nota y
--   categoría si llegan) del ingreso; el trigger copia monto, fecha y hora;
-- - con cuenta y sin movimiento (una compra, o un avance anterior a SPEC 36
--   con la cuenta en el abono): se crea el ingreso "Avance de tarjeta" y se
--   enlaza; la cuenta deja el abono;
-- - sin cuenta: queda como compra; si tenía ingreso, se borra.
-- p_description y p_category_id null conservan los del movimiento. Todo pasa
-- por RLS (security invoker). Devuelve el id del abono.
create function public.update_card_advance(
  p_entry_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_occurred_time time,
  p_note text,
  p_account_id uuid,
  p_installments smallint,
  p_description text,
  p_category_id uuid
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_entry public.debt_entries;
  v_debt public.debts;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  select * into v_entry
  from public.debt_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'No se encontró el movimiento'
      using errcode = 'no_data_found';
  end if;

  select * into v_debt
  from public.debts
  where id = v_entry.debt_id
  for update;

  if not found then
    raise exception 'No se encontró la deuda'
      using errcode = 'no_data_found';
  end if;

  if v_debt.status <> 'active'
    or not public.is_workspace_writable(v_debt.workspace_id)
  then
    raise exception 'Reactiva la deuda para registrar pagos'
      using errcode = 'check_violation';
  end if;

  if v_entry.kind <> 'advance' then
    raise exception 'Solo se editan así las compras y avances de una tarjeta'
      using errcode = 'check_violation', hint = 'not_advance';
  end if;

  v_transaction_id := v_entry.transaction_id;

  if p_account_id is null then
    -- Compra: sin ingreso. El abono suelta el enlace antes de borrar el
    -- movimiento (sync_debt_entry_transaction no lo borra en un update)
    update public.debt_entries
    set amount = p_amount,
        occurred_on = p_occurred_on,
        occurred_time = p_occurred_time,
        note = p_note,
        installments = p_installments,
        account_id = null,
        transaction_id = null
    where id = v_entry.id;

    if v_transaction_id is not null then
      delete from public.transactions where id = v_transaction_id;
    end if;

    return v_entry.id;
  end if;

  if v_transaction_id is null then
    v_category_id := p_category_id;
    if v_category_id is null then
      select id into v_category_id
      from public.categories
      where workspace_id is null
        and scope = 'personal'
        and type = 'income'
        and name = 'Avance de tarjeta';
    end if;

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, occurred_time,
      description, note, account_id
    ) values (
      v_debt.workspace_id,
      'income',
      p_amount,
      v_category_id,
      p_occurred_on,
      p_occurred_time,
      coalesce(nullif(btrim(p_description), ''), 'Avance ' || v_debt.name),
      p_note,
      p_account_id
    )
    returning id into v_transaction_id;
  else
    update public.transactions
    set account_id = p_account_id,
        description = coalesce(nullif(btrim(p_description), ''), description),
        note = p_note,
        category_id = coalesce(p_category_id, category_id)
    where id = v_transaction_id;
  end if;

  -- sync_debt_entry_transaction copia monto, fecha y hora al movimiento
  update public.debt_entries
  set amount = p_amount,
      occurred_on = p_occurred_on,
      occurred_time = p_occurred_time,
      note = p_note,
      installments = p_installments,
      account_id = null,
      transaction_id = v_transaction_id
  where id = v_entry.id;

  return v_entry.id;
end;
$$;

revoke execute on function public.update_card_advance(uuid, numeric, date, time, text, uuid, smallint, text, uuid) from public, anon;
grant execute on function public.update_card_advance(uuid, numeric, date, time, text, uuid, smallint, text, uuid) to authenticated;

-- 7. convert_debt_adjustment_to_charge -----------------------------------------

-- Convierte un ajuste que subió el saldo de una tarjeta activa en:
-- - 'advance': compra (sin cuenta) o avance (con cuenta: crea el ingreso
--   "Avance de tarjeta", SPEC 36), con cuotas opcionales;
-- - 'fee': cuota de manejo (SPEC 17), sin cuenta ni cuotas.
-- Mismo monto: el saldo de la deuda no cambia. Todo pasa por RLS (security
-- invoker). Devuelve el id del abono.
create function public.convert_debt_adjustment_to_charge(
  p_entry_id uuid,
  p_kind text,
  p_account_id uuid,
  p_installments smallint,
  p_occurred_on date,
  p_occurred_time time,
  p_note text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_entry public.debt_entries;
  v_debt public.debts;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  if p_kind is null or p_kind not in ('advance', 'fee') then
    raise exception 'Elige qué fue este ajuste'
      using errcode = 'check_violation', hint = 'kind_invalid';
  end if;

  select * into v_entry
  from public.debt_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'No se encontró el movimiento'
      using errcode = 'no_data_found';
  end if;

  select * into v_debt
  from public.debts
  where id = v_entry.debt_id
  for update;

  if not found then
    raise exception 'No se encontró la deuda'
      using errcode = 'no_data_found';
  end if;

  if v_debt.status <> 'active'
    or not public.is_workspace_writable(v_debt.workspace_id)
  then
    raise exception 'Reactiva la deuda para registrar pagos'
      using errcode = 'check_violation';
  end if;

  if v_debt.kind <> 'credit_card'
    or v_entry.kind <> 'adjustment'
    or v_entry.amount <= 0
  then
    raise exception 'Solo un ajuste que subió el saldo de una tarjeta se puede convertir'
      using errcode = 'check_violation', hint = 'not_convertible';
  end if;

  if p_kind = 'fee' and (p_account_id is not null or p_installments is not null) then
    raise exception 'Una cuota de manejo no lleva cuenta ni cuotas'
      using errcode = 'check_violation', hint = 'kind_invalid';
  end if;

  if p_kind = 'advance' and p_account_id is not null then
    select id into v_category_id
    from public.categories
    where workspace_id is null
      and scope = 'personal'
      and type = 'income'
      and name = 'Avance de tarjeta';

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, occurred_time,
      description, note, account_id
    ) values (
      v_debt.workspace_id,
      'income',
      v_entry.amount,
      v_category_id,
      p_occurred_on,
      p_occurred_time,
      'Avance ' || v_debt.name,
      p_note,
      p_account_id
    )
    returning id into v_transaction_id;
  end if;

  update public.debt_entries
  set kind = p_kind::public.debt_entry_kind,
      occurred_on = p_occurred_on,
      occurred_time = p_occurred_time,
      note = p_note,
      installments = case when p_kind = 'advance' then p_installments end,
      transaction_id = v_transaction_id
  where id = v_entry.id;

  return v_entry.id;
end;
$$;

revoke execute on function public.convert_debt_adjustment_to_charge(uuid, text, uuid, smallint, date, time, text) from public, anon;
grant execute on function public.convert_debt_adjustment_to_charge(uuid, text, uuid, smallint, date, time, text) to authenticated;

-- 8. Avances anteriores a SPEC 36 ---------------------------------------------

-- La conversión de datos de SPEC 36 (20261113120000) no pudo convertir ningún
-- avance por el check del paso 1. Se repite igual: cada avance con la cuenta
-- en el abono recibe su ingreso y la cuenta pasa al movimiento. El saldo de
-- la cuenta no cambia. Fila por fila: si una viola un trigger (tarjeta
-- pagada o archivada, cuenta archivada) queda como estaba y se convierte al
-- editarla con update_card_advance.
do $$
declare
  v_row record;
  v_category_id uuid;
  v_transaction_id uuid;
  v_converted integer := 0;
  v_skipped integer := 0;
begin
  select id into v_category_id
  from public.categories
  where workspace_id is null
    and scope = 'personal'
    and type = 'income'
    and name = 'Avance de tarjeta';

  for v_row in
    select e.id, e.workspace_id, e.amount, e.occurred_on, e.occurred_time,
           e.account_id, d.name as debt_name
    from public.debt_entries e
    join public.debts d on d.id = e.debt_id
    where e.kind = 'advance'
      and e.account_id is not null
      and e.transaction_id is null
    order by e.occurred_on, e.created_at
  loop
    begin
      insert into public.transactions (
        workspace_id, type, amount, category_id, occurred_on, occurred_time,
        description, account_id
      ) values (
        v_row.workspace_id,
        'income',
        v_row.amount,
        v_category_id,
        v_row.occurred_on,
        v_row.occurred_time,
        'Avance ' || v_row.debt_name,
        v_row.account_id
      )
      returning id into v_transaction_id;

      update public.debt_entries
      set transaction_id = v_transaction_id,
          account_id = null
      where id = v_row.id;

      v_converted := v_converted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
      raise notice 'Avance % sin convertir: %', v_row.id, sqlerrm;
    end;
  end loop;

  raise notice 'Avances convertidos en ingreso: %, sin convertir: %',
    v_converted, v_skipped;
end;
$$;
