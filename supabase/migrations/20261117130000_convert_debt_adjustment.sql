-- SPEC 42: convertir en pago un ajuste que bajó el saldo de una deuda.
--
-- Un pago real registrado como ajuste (Actualizar saldo o importación) baja
-- el saldo pero no sale de ninguna cuenta. Convertirlo cambia el ajuste a
-- pago con el monto en positivo: el saldo de la deuda no cambia y el de la
-- cuenta sí. No hay tablas ni columnas nuevas.

-- 1. check_debt_entry: un ajuste negativo puede pasar a pago ---------------------

-- Misma función de SPEC 39 (20261114120000). Lo único nuevo: en un update se
-- permite el cambio de tipo adjustment → payment con el monto opuesto (el
-- saldo no cambia). El resto de reglas siguen aplicando al pago resultante.
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

    -- Convertir un ajuste que bajó el saldo en pago (SPEC 42): mismo monto
    -- en positivo, así el saldo de la deuda no cambia
    if new.kind <> old.kind and not (
      old.kind = 'adjustment'
      and new.kind = 'payment'
      and old.amount < 0
      and new.amount = -old.amount
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

-- 2. convert_debt_adjustment ---------------------------------------------------

-- Convierte un ajuste negativo de una deuda activa en pago (o cobro en Me
-- deben), en una sola transacción:
--   - el ajuste pasa a kind = 'payment' con el monto en positivo, la fecha,
--     la hora y la nota dadas;
--   - préstamo o Me deben: se enlaza al movimiento p_link_transaction_id (que
--     toma la cuenta, la descripción, la nota y la categoría dadas) o se crea
--     uno nuevo ("Pago {nombre}" / "Abono {nombre}" si no hay descripción);
--   - tarjeta: el pago guarda la cuenta (sin movimiento, SPEC 16). Si se
--     eligió un gasto suelto, se borra para no contar dos veces la salida.
-- En una mensual, el cambio de monto reparte el abono entre las cuotas
-- (debt_entries_reallocate_on_update → allocate_debt_entry). El saldo de la
-- deuda no cambia. Todo pasa por RLS (security invoker): solo el dueño de un
-- espacio escribible convierte o enlaza. Devuelve el id del abono.
create function public.convert_debt_adjustment(
  p_entry_id uuid,
  p_account_id uuid,
  p_occurred_on date,
  p_occurred_time time,
  p_description text,
  p_note text,
  p_category_id uuid,
  p_link_transaction_id uuid
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
  v_amount numeric;
  v_type public.transaction_type;
  v_category_id uuid;
  v_description text;
  v_transaction_id uuid;
  v_link public.transactions;
begin
  select * into v_entry
  from public.debt_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'No se encontró el pago'
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

  if v_entry.kind <> 'adjustment' or v_entry.amount >= 0 then
    raise exception 'Solo un ajuste que bajó el saldo se puede convertir en pago'
      using errcode = 'check_violation', hint = 'not_convertible';
  end if;

  if p_account_id is null then
    raise exception 'Elige la cuenta del pago'
      using errcode = 'check_violation', hint = 'account_required';
  end if;

  v_amount := -v_entry.amount;
  -- Tarjeta y préstamo: sale dinero (gasto). Me deben: entra (ingreso)
  v_type := case v_debt.kind when 'receivable' then 'income' else 'expense' end;

  if p_link_transaction_id is not null then
    select * into v_link
    from public.transactions t
    where t.id = p_link_transaction_id
    for update;

    -- Mismo espacio, tipo y monto, y sin enlazar a un abono ni a un gasto o
    -- ingreso fijo
    if not found
      or v_link.workspace_id <> v_debt.workspace_id
      or v_link.type <> v_type
      or v_link.amount <> v_amount
      or v_link.recurring_expense_id is not null
      or v_link.recurring_income_id is not null
      or exists (
        select 1 from public.debt_entries e
        where e.transaction_id = v_link.id
      )
    then
      raise exception 'El movimiento no se puede enlazar a este pago'
        using errcode = 'check_violation', hint = 'link_invalid';
    end if;
  end if;

  if v_debt.kind = 'credit_card' then
    -- El pago de tarjeta vive en el abono: el gasto suelto contaría dos veces
    -- la salida de la cuenta
    if p_link_transaction_id is not null then
      delete from public.transactions where id = p_link_transaction_id;
    end if;

    update public.debt_entries
    set kind = 'payment',
        amount = v_amount,
        occurred_on = p_occurred_on,
        occurred_time = p_occurred_time,
        note = p_note,
        account_id = p_account_id
    where id = v_entry.id;

    return v_entry.id;
  end if;

  if p_link_transaction_id is not null then
    v_transaction_id := p_link_transaction_id;

    update public.transactions
    set account_id = p_account_id,
        description = coalesce(nullif(btrim(p_description), ''), description),
        note = p_note,
        category_id = coalesce(p_category_id, category_id)
    where id = v_transaction_id;
  else
    -- Categoría por defecto de los pagos de deuda (SPEC 06): Deudas / Cobros
    v_category_id := p_category_id;
    if v_category_id is null then
      select id into v_category_id
      from public.categories
      where workspace_id is null
        and scope = 'personal'
        and type = v_type
        and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;
    end if;

    v_description := coalesce(
      nullif(btrim(p_description), ''),
      case v_type when 'income' then 'Abono ' else 'Pago ' end || v_debt.name
    );

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, occurred_time,
      description, note, account_id
    ) values (
      v_debt.workspace_id,
      v_type,
      v_amount,
      v_category_id,
      p_occurred_on,
      p_occurred_time,
      v_description,
      p_note,
      p_account_id
    )
    returning id into v_transaction_id;
  end if;

  -- sync_debt_entry_transaction copia monto, fecha y hora al movimiento
  update public.debt_entries
  set kind = 'payment',
      amount = v_amount,
      occurred_on = p_occurred_on,
      occurred_time = p_occurred_time,
      note = p_note,
      transaction_id = v_transaction_id
  where id = v_entry.id;

  return v_entry.id;
end;
$$;

revoke execute on function public.convert_debt_adjustment(uuid, uuid, date, time, text, text, uuid, uuid) from public, anon;
grant execute on function public.convert_debt_adjustment(uuid, uuid, date, time, text, text, uuid, uuid) to authenticated;
