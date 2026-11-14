-- Un cobro, varias cuotas (SPEC 39).
--
-- Hasta SPEC 29 cada abono de una cuenta por cobrar mensual cobraba una sola
-- cuota (debt_entries.period_on). Ahora un abono se reparte entre varias
-- cuotas con debt_entry_allocations: una fila por cuota con la parte del
-- abono que la cubre. El abono sigue enlazado a un solo movimiento
-- (debt_entries.transaction_id) con el monto total, así que
-- sync_debt_entry_transaction no cambia.
--
-- Reglas:
--   - solo los abonos (payment) de cuentas por cobrar mensuales tienen
--     asignaciones, y la suma de las de un abono es igual a su monto
--     (se revisa al final de la transacción);
--   - el reparto va desde la cuota no pagada más antigua, igual que
--     allocateOldestFirst (SPEC 38). Lo que falta en cada cuota descuenta lo
--     que otros abonos ya asignaron. En indefinidas llega hasta 12 meses
--     después del actual; con número de cuotas, hasta la última. Si sobra,
--     error;
--   - cambiar el monto de un abono lo reparte de nuevo; borrarlo borra sus
--     asignaciones en cascada.

-- 1. Tabla -------------------------------------------------------------------

create table public.debt_entry_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entry_id uuid not null references public.debt_entries (id) on delete cascade,
  period_on date not null, -- primer día del mes de la cuota
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (entry_id, period_on)
);

comment on table public.debt_entry_allocations is
  'Parte de un abono de una cuenta por cobrar mensual que cubre cada cuota';

create index debt_entry_allocations_period
  on public.debt_entry_allocations (period_on);

alter table public.debt_entry_allocations enable row level security;

create policy "debt_entry_allocations_select_own"
  on public.debt_entry_allocations for select
  to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "debt_entry_allocations_insert_own"
  on public.debt_entry_allocations for insert
  to authenticated
  with check (public.is_workspace_writable(workspace_id));

create policy "debt_entry_allocations_update_own"
  on public.debt_entry_allocations for update
  to authenticated
  using (public.is_workspace_writable(workspace_id))
  with check (public.is_workspace_writable(workspace_id));

create policy "debt_entry_allocations_delete_own"
  on public.debt_entry_allocations for delete
  to authenticated
  using (public.is_workspace_writable(workspace_id));

-- Las tablas nuevas no reciben privilegios por defecto (ver SPEC 27)
grant select, insert, update, delete on public.debt_entry_allocations
  to authenticated;

-- 2. Migración de datos ------------------------------------------------------

-- Cada abono con cuota pasa a una asignación por su monto completo
insert into public.debt_entry_allocations (workspace_id, entry_id, period_on, amount)
select e.workspace_id, e.id, e.period_on, e.amount
from public.debt_entries e
where e.period_on is not null
  and e.amount > 0;

-- 3. check_debt_entry sin period_on ------------------------------------------

-- check_debt_entry (SPEC 06, 16, 17, 19, 28 y 36) sin las reglas de period_on:
-- la cuota la validan las asignaciones
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

    -- Solo cambian hora u orden del día: no afecta el saldo
    if new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.transaction_id is not distinct from old.transaction_id
      and new.account_id is not distinct from old.account_id
    then
      return new;
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

-- 4. record_debt_payment sin p_period_on ------------------------------------

-- record_debt_payment (SPEC 26 y 28) pierde p_period_on. Un abono de una
-- mensual creado por aquí se reparte desde la cuota más antigua al final de la
-- transacción (check_debt_entry_allocations_total); el cobro con cuota
-- elegida va por record_receivable_collection.
drop function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time, boolean, date);

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

-- 5. Se borra period_on -------------------------------------------------------

-- El índice debt_entries_period y el check del día 1 caen con la columna
alter table public.debt_entries drop column period_on;

-- 6. Validación de cada asignación -----------------------------------------

-- El abono es un payment de una cuenta por cobrar mensual del mismo espacio;
-- la cuota es día 1, no anterior al mes de inicio y, con número de cuotas, no
-- posterior a la última
create function public.check_debt_entry_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_first_period date;
begin
  select d.* into v_debt
  from public.debt_entries e
  join public.debts d on d.id = e.debt_id
  where e.id = new.entry_id
    and e.workspace_id = new.workspace_id
    and e.kind = 'payment';

  if not found
    or v_debt.kind <> 'receivable'
    or v_debt.schedule is distinct from 'monthly'
  then
    raise exception 'Solo los cobros de una cuenta por cobrar mensual llevan cuotas'
      using errcode = 'check_violation';
  end if;

  if extract(day from new.period_on) <> 1 then
    raise exception 'La cuota debe ser el primer día del mes'
      using errcode = 'check_violation';
  end if;

  v_first_period := date_trunc('month', v_debt.starts_on::timestamp)::date;

  if new.period_on < v_first_period then
    raise exception 'La cuota es anterior al inicio del cobro'
      using errcode = 'check_violation', hint = 'installment_out_of_range';
  end if;

  if v_debt.term_months is not null
    and new.period_on > (v_first_period + make_interval(months => v_debt.term_months - 1))::date
  then
    raise exception 'La cuota es posterior a la última cuota'
      using errcode = 'check_violation', hint = 'installment_out_of_range';
  end if;

  return new;
end;
$$;

create trigger debt_entry_allocations_check
  before insert or update on public.debt_entry_allocations
  for each row execute function public.check_debt_entry_allocation();

-- 7. Valor y saldo de una cuota ------------------------------------------------

-- Valor de la cuota del mes p_period_on (SPEC 29): el valor anterior con el
-- menor through_period que lo cubre o, si ninguno, el valor actual
create function public.receivable_installment_amount(p_debt_id uuid, p_period_on date)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select h.amount
      from public.receivable_installment_history h
      where h.debt_id = d.id
        and h.through_period >= p_period_on
      order by h.through_period
      limit 1
    ),
    d.installment
  )
  from public.debts d
  where d.id = p_debt_id;
$$;

revoke execute on function public.receivable_installment_amount(uuid, date) from public, anon;
grant execute on function public.receivable_installment_amount(uuid, date) to authenticated;

-- 8. Reparto ----------------------------------------------------------------

-- Borra las asignaciones del abono y las vuelve a crear:
--   - con p_period_on, todo a esa cuota (no puede pasar de lo que falta en
--     ella);
--   - sin p_period_on, desde la cuota no pagada más antigua.
-- Lo que falta en cada cuota no cuenta las asignaciones propias. Bloquea la
-- cuenta por cobrar: dos cobros a la vez no reparten sobre lo mismo. Un abono
-- que no es de una mensual queda sin asignaciones. Devuelve lo asignado.
create function public.allocate_debt_entry(p_entry_id uuid, p_period_on date default null)
returns table (period_on date, amount numeric)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry public.debt_entries;
  v_debt public.debts;
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_first date;
  v_last date;
  v_period date;
  v_due numeric;
  v_remaining numeric;
  v_part numeric;
begin
  select * into v_entry
  from public.debt_entries e
  where e.id = p_entry_id;

  if not found then
    raise exception 'El abono no existe'
      using errcode = 'no_data_found';
  end if;

  select * into v_debt
  from public.debts d
  where d.id = v_entry.debt_id
  for update;

  delete from public.debt_entry_allocations a
  where a.entry_id = p_entry_id;

  if v_entry.kind <> 'payment'
    or v_debt.kind <> 'receivable'
    or v_debt.schedule is distinct from 'monthly'
  then
    if p_period_on is not null then
      raise exception 'Solo los cobros de una cuenta por cobrar mensual llevan cuotas'
        using errcode = 'check_violation';
    end if;
    return;
  end if;

  v_first := date_trunc('month', v_debt.starts_on::timestamp)::date;
  -- Indefinida: hasta 12 meses después del actual. Con cuotas: la última
  v_last := case
    when v_debt.term_months is null
      then (date_trunc('month', v_today::timestamp) + interval '12 months')::date
    else (v_first + make_interval(months => v_debt.term_months - 1))::date
  end;

  v_remaining := v_entry.amount;

  if p_period_on is not null then
    v_due := public.receivable_installment_amount(v_debt.id, p_period_on)
      - coalesce((
          select sum(a.amount)
          from public.debt_entry_allocations a
          join public.debt_entries e on e.id = a.entry_id
          where e.debt_id = v_debt.id
            and a.period_on = p_period_on
        ), 0);

    if v_remaining > v_due then
      raise exception 'El monto supera lo que falta de la cuota'
        using errcode = 'check_violation', hint = 'installment_exceeds';
    end if;

    -- check_debt_entry_allocation valida el rango de la cuota
    insert into public.debt_entry_allocations (workspace_id, entry_id, period_on, amount)
    values (v_entry.workspace_id, v_entry.id, p_period_on, v_remaining);

    period_on := p_period_on;
    amount := v_remaining;
    return next;
    return;
  end if;

  for v_period in
    select g::date
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 month') as g
  loop
    exit when v_remaining <= 0;

    v_due := public.receivable_installment_amount(v_debt.id, v_period)
      - coalesce((
          select sum(a.amount)
          from public.debt_entry_allocations a
          join public.debt_entries e on e.id = a.entry_id
          where e.debt_id = v_debt.id
            and a.period_on = v_period
        ), 0);

    continue when v_due <= 0;

    v_part := least(v_remaining, v_due);

    insert into public.debt_entry_allocations (workspace_id, entry_id, period_on, amount)
    values (v_entry.workspace_id, v_entry.id, v_period, v_part);

    v_remaining := v_remaining - v_part;
    period_on := v_period;
    amount := v_part;
    return next;
  end loop;

  if v_remaining > 0 then
    if v_debt.term_months is null then
      raise exception 'El monto cubre más de 12 meses por delante'
        using errcode = 'check_violation', hint = 'allocation_future_limit';
    end if;
    raise exception 'El monto supera lo que falta por cobrar'
      using errcode = 'check_violation', hint = 'allocation_exceeds_end';
  end if;
end;
$$;

revoke execute on function public.allocate_debt_entry(uuid, date) from public, anon;

-- Reparte de nuevo un abono desde la cuota no pagada más antigua (al editar
-- su monto). Devuelve lo asignado.
create function public.reallocate_debt_entry(p_entry_id uuid)
returns table (period_on date, amount numeric)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from public.allocate_debt_entry(p_entry_id, null);
$$;

revoke execute on function public.reallocate_debt_entry(uuid) from public, anon;
grant execute on function public.reallocate_debt_entry(uuid) to authenticated;

-- allocate_debt_entry no es RPC, pero las funciones que la llaman corren como
-- el usuario
grant execute on function public.allocate_debt_entry(uuid, date) to authenticated;

-- Cambiar el monto de un abono (desde el Sheet, desde Movimientos vía
-- sync_debt_entry_transaction o al revertir una operación del MCP) lo reparte
-- de nuevo
create function public.reallocate_debt_entry_on_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.allocate_debt_entry(new.id, null);
  return null;
end;
$$;

create trigger debt_entries_reallocate_on_update
  after update of amount on public.debt_entries
  for each row
  when (old.amount is distinct from new.amount and new.kind = 'payment')
  execute function public.reallocate_debt_entry_on_update();

-- Al final de la transacción, la suma de las asignaciones de un abono de una
-- mensual es igual a su monto. Un abono sin asignaciones (creado por
-- record_debt_payment o recreado al revertir una operación del MCP) se
-- reparte desde la cuota más antigua.
create function public.check_debt_entry_allocations_total()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_amount numeric;
  v_monthly boolean;
  v_allocated numeric;
  v_count int;
begin
  if tg_table_name = 'debt_entries' then
    v_entry_id := new.id;
  elsif tg_op = 'DELETE' then
    v_entry_id := old.entry_id;
  else
    v_entry_id := new.entry_id;
  end if;

  select e.amount,
         e.kind = 'payment' and d.kind = 'receivable' and d.schedule = 'monthly'
    into v_amount, v_monthly
  from public.debt_entries e
  join public.debts d on d.id = e.debt_id
  where e.id = v_entry_id;

  -- Abono borrado en la misma transacción
  if not found or not v_monthly then
    return null;
  end if;

  select coalesce(sum(a.amount), 0), count(*)
    into v_allocated, v_count
  from public.debt_entry_allocations a
  where a.entry_id = v_entry_id;

  if v_count = 0 then
    perform public.allocate_debt_entry(v_entry_id, null);
    return null;
  end if;

  if v_allocated <> v_amount then
    raise exception 'Las cuotas del cobro no suman su monto'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger debt_entries_check_allocations_total
  after insert or update of amount on public.debt_entries
  deferrable initially deferred
  for each row
  when (new.kind = 'payment')
  execute function public.check_debt_entry_allocations_total();

create constraint trigger debt_entry_allocations_check_total
  after insert or update or delete on public.debt_entry_allocations
  deferrable initially deferred
  for each row
  execute function public.check_debt_entry_allocations_total();

-- Las funciones de trigger no se exponen como RPC
revoke execute on function public.check_debt_entry_allocation() from public, anon, authenticated;
revoke execute on function public.reallocate_debt_entry_on_update() from public, anon, authenticated;
revoke execute on function public.check_debt_entry_allocations_total() from public, anon, authenticated;

-- 9. Cobro de una cuenta por cobrar ------------------------------------------

-- Crea el abono y, si p_create_transaction, el ingreso enlazado (categoría
-- Cobros) en p_account_id. Según el tipo de cobro:
--   - once: p_mode 'partial' (monto hasta el saldo) o 'full' (monto igual al
--     saldo);
--   - monthly: p_mode 'single' (todo a la cuota p_period_on) o 'allocate'
--     (reparte desde la cuota no pagada más antigua).
-- Si el cobro deja en cero el saldo de una cuenta por cobrar con saldo total
-- (una vez, o mensual con número de cuotas), pasa a pagada. Devuelve el id
-- del abono.
create function public.record_receivable_collection(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean,
  p_account_id uuid default null,
  p_mode text default 'allocate',
  p_period_on date default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_balance numeric;
  v_category_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt_id
  for update;

  if not found or v_debt.kind <> 'receivable' then
    raise exception 'La cuenta por cobrar no existe'
      using errcode = 'no_data_found';
  end if;

  if v_debt.status <> 'active' then
    raise exception 'Reactiva la deuda para registrar pagos'
      using errcode = 'check_violation';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero'
      using errcode = 'check_violation', hint = 'amount_not_positive';
  end if;

  if v_debt.schedule = 'monthly' then
    if p_mode not in ('single', 'allocate') then
      raise exception 'Modo de cobro no válido para un cobro mensual'
        using errcode = 'check_violation';
    end if;
    if (p_mode = 'single') <> (p_period_on is not null) then
      raise exception 'Elige la cuota que se cobra'
        using errcode = 'check_violation', hint = 'installment_required';
    end if;
  else
    if p_mode not in ('partial', 'full') or p_period_on is not null then
      raise exception 'Modo de cobro no válido para un cobro único'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Saldo actual: saldo inicial − abonos + ajustes
  select v_debt.opening_balance
         - coalesce(sum(e.amount) filter (where e.kind = 'payment'), 0)
         + coalesce(sum(e.amount) filter (where e.kind <> 'payment'), 0)
    into v_balance
  from public.debt_entries e
  where e.debt_id = v_debt.id;

  -- Con saldo total (no indefinida), el cobro no puede pasar de lo que falta
  if not (v_debt.schedule = 'monthly' and v_debt.term_months is null) then
    if p_amount > v_balance then
      raise exception 'El monto supera el saldo pendiente'
        using errcode = 'check_violation', hint = 'over_payment';
    end if;
    if p_mode = 'full' and p_amount <> v_balance then
      raise exception 'El pago completo debe ser igual al saldo pendiente'
        using errcode = 'check_violation', hint = 'full_payment_mismatch';
    end if;
  end if;

  if p_create_transaction then
    select id into v_category_id
    from public.categories
    where workspace_id is null
      and scope = 'personal'
      and type = 'income'
      and name = 'Cobros';

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, description,
      account_id
    ) values (
      v_debt.workspace_id,
      'income',
      p_amount,
      v_category_id,
      p_occurred_on,
      'Abono ' || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_note,
    v_transaction_id
  )
  returning id into v_entry_id;

  if v_debt.schedule = 'monthly' then
    perform public.allocate_debt_entry(v_entry_id, p_period_on);

    -- La suma la revisa también el trigger diferido; aquí el error sale antes
    if (
      select coalesce(sum(a.amount), 0)
      from public.debt_entry_allocations a
      where a.entry_id = v_entry_id
    ) <> p_amount then
      raise exception 'Las cuotas del cobro no suman su monto'
        using errcode = 'check_violation';
    end if;
  end if;

  if not (v_debt.schedule = 'monthly' and v_debt.term_months is null)
    and v_balance - p_amount = 0
  then
    update public.debts
    set status = 'paid', closed_at = now()
    where id = v_debt.id;
  end if;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_receivable_collection(uuid, numeric, date, text, boolean, uuid, text, date) from public, anon;
grant execute on function public.record_receivable_collection(uuid, numeric, date, text, boolean, uuid, text, date) to authenticated;
