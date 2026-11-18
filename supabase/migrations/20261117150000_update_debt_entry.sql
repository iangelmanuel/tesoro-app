-- SPEC 42, parte 3: un solo formulario para editar cualquier movimiento de
-- una deuda, como si se volviera a crear. El tipo se puede cambiar entre
-- pago, abono, compra o avance, cuota de manejo y ajuste; update_debt_entry
-- deja el abono y su movimiento como quedarían al registrarlo de nuevo.
--
-- Reemplaza a convert_debt_adjustment y convert_debt_adjustment_to_charge,
-- que solo convertían ajustes.

-- 1. check_debt_entry: el tipo puede cambiar -----------------------------------

-- Misma función de la parte 2 (20261117140000) sin la regla de tipos: un
-- movimiento puede pasar a cualquier tipo. El resultado sigue pasando por las
-- mismas reglas (tipo según la deuda, cuenta, movimiento, checks de la tabla)
-- y check_debt_balance revisa el saldo. La deuda sigue sin poder cambiar.
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
      raise exception 'Una entrada no puede cambiar de deuda'
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
      and new.is_extra_payment = old.is_extra_payment
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
        (v_kind = 'loan' and new.kind = 'payment' and t.type = 'expense')
        or (v_kind = 'receivable' and new.kind = 'payment' and t.type = 'income')
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

-- 2. update_debt_entry ---------------------------------------------------------

-- Reescribe un movimiento de una deuda activa en una sola transacción, como
-- si se registrara de nuevo con el tipo y los datos dados:
--   p_kind: 'payment' (pago o, con p_is_extra_payment, abono extra), 'advance'
--     (compra sin cuenta, avance con cuenta), 'fee' (cuota de manejo) o
--     'adjustment' (monto con signo). advance y fee solo en tarjetas; una
--     cuenta por cobrar mensual no admite ajustes nuevos.
--   p_account_id: tarjeta → la cuenta del pago (en el abono) o la que recibe
--     el avance (en su ingreso); préstamo o Me deben → la del movimiento.
--   p_create_transaction: préstamo o Me deben, registrar el pago como gasto
--     o ingreso. Sin él, el movimiento que tuviera se borra.
--   p_description, p_category_id: del movimiento; null conserva los que
--     tiene o usa los de siempre ("Pago {nombre}", Deudas…).
--   p_link_transaction_id: un gasto o ingreso suelto ya registrado del mismo
--     monto. Préstamo, Me deben o avance: pasa a ser su movimiento. Pago de
--     tarjeta: se borra, porque el pago ya descuenta de la cuenta.
-- El movimiento anterior se reutiliza si sigue siendo del mismo tipo; si no,
-- se borra. En una mensual de Me deben el cobro se reparte de nuevo. Todo pasa
-- por RLS (security invoker). Devuelve el id del abono.
create function public.update_debt_entry(
  p_entry_id uuid,
  p_kind text,
  p_amount numeric,
  p_occurred_on date,
  p_occurred_time time,
  p_note text,
  p_account_id uuid,
  p_create_transaction boolean,
  p_is_extra_payment boolean,
  p_installments smallint,
  p_description text,
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
  v_kind public.debt_entry_kind;
  v_extra boolean;
  v_tx_type public.transaction_type;
  v_link_type public.transaction_type;
  v_link public.transactions;
  v_old_tx uuid;
  v_old_tx_type public.transaction_type;
  v_tx uuid;
  v_category_id uuid;
  v_description text;
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

  if p_kind is null or p_kind not in ('payment', 'advance', 'fee', 'adjustment') then
    raise exception 'Elige el tipo de movimiento'
      using errcode = 'check_violation', hint = 'kind_invalid';
  end if;
  v_kind := p_kind::public.debt_entry_kind;

  if v_kind in ('advance', 'fee') and v_debt.kind <> 'credit_card' then
    raise exception 'Ese tipo de movimiento solo existe en las tarjetas'
      using errcode = 'check_violation', hint = 'kind_invalid';
  end if;

  if v_kind = 'adjustment'
    and v_entry.kind <> 'adjustment'
    and v_debt.kind = 'receivable'
    and v_debt.schedule = 'monthly'
  then
    raise exception 'Un cobro mensual no lleva ajustes'
      using errcode = 'check_violation', hint = 'kind_invalid';
  end if;

  if p_amount is null
    or p_amount = 0
    or (v_kind <> 'adjustment' and p_amount < 0)
  then
    raise exception 'El monto debe ser mayor que cero'
      using errcode = 'check_violation', hint = 'amount_not_positive';
  end if;

  v_extra := coalesce(p_is_extra_payment, false)
    and v_kind = 'payment'
    and v_debt.kind <> 'receivable';

  -- Movimiento que debe quedar enlazado, por tipo
  v_tx_type := case
    when v_kind = 'payment' and v_debt.kind = 'loan' and p_create_transaction
      then 'expense'
    when v_kind = 'payment' and v_debt.kind = 'receivable' and p_create_transaction
      then 'income'
    when v_kind = 'advance' and p_account_id is not null
      then 'income'
  end::public.transaction_type;

  if v_tx_type is not null
    and v_kind = 'payment'
    and p_account_id is null
    and p_link_transaction_id is null
  then
    raise exception 'Elige la cuenta del pago'
      using errcode = 'check_violation', hint = 'account_required';
  end if;

  -- Movimiento ya registrado: el pago de tarjeta lo reemplaza (gasto); el
  -- resto lo adopta como su movimiento
  if p_link_transaction_id is not null then
    v_link_type := case
      when v_kind = 'payment' and v_debt.kind = 'credit_card' then 'expense'
      else v_tx_type
    end::public.transaction_type;

    select * into v_link
    from public.transactions t
    where t.id = p_link_transaction_id
    for update;

    if v_link_type is null
      or not found
      or v_link.workspace_id <> v_debt.workspace_id
      or v_link.type <> v_link_type
      or v_link.amount <> p_amount
      or v_link.recurring_expense_id is not null
      or v_link.recurring_income_id is not null
      or exists (
        select 1 from public.debt_entries e
        where e.transaction_id = v_link.id
          and e.id <> v_entry.id
      )
    then
      raise exception 'El movimiento no se puede enlazar a este pago'
        using errcode = 'check_violation', hint = 'link_invalid';
    end if;
  end if;

  v_old_tx := v_entry.transaction_id;
  if v_old_tx is not null then
    select type into v_old_tx_type
    from public.transactions
    where id = v_old_tx;
  end if;

  if v_tx_type is not null then
    if p_link_transaction_id is not null then
      v_tx := p_link_transaction_id;
    elsif v_old_tx is not null and v_old_tx_type = v_tx_type then
      v_tx := v_old_tx;
    end if;

    if v_tx is not null then
      update public.transactions
      set account_id = p_account_id,
          description = coalesce(nullif(btrim(p_description), ''), description),
          note = p_note,
          category_id = coalesce(p_category_id, category_id),
          amount = p_amount,
          occurred_on = p_occurred_on,
          occurred_time = p_occurred_time
      where id = v_tx;
    else
      -- Categoría y descripción de siempre (SPEC 06, 36 y 41)
      v_category_id := p_category_id;
      if v_category_id is null then
        select id into v_category_id
        from public.categories
        where workspace_id is null
          and scope = 'personal'
          and type = v_tx_type
          and name = case
            when v_kind = 'advance' then 'Avance de tarjeta'
            when v_tx_type = 'expense' then 'Deudas'
            else 'Cobros'
          end;
      end if;

      v_description := coalesce(
        nullif(btrim(p_description), ''),
        case
          when v_kind = 'advance' then 'Avance '
          when v_tx_type = 'income' or v_extra then 'Abono '
          else 'Pago '
        end || v_debt.name
      );

      insert into public.transactions (
        workspace_id, type, amount, category_id, occurred_on, occurred_time,
        description, note, account_id
      ) values (
        v_debt.workspace_id,
        v_tx_type,
        p_amount,
        v_category_id,
        p_occurred_on,
        p_occurred_time,
        v_description,
        p_note,
        p_account_id
      )
      returning id into v_tx;
    end if;
  end if;

  update public.debt_entries
  set kind = v_kind,
      amount = p_amount,
      occurred_on = p_occurred_on,
      occurred_time = p_occurred_time,
      note = p_note,
      account_id = case
        when v_kind = 'payment' and v_debt.kind = 'credit_card' then p_account_id
      end,
      transaction_id = v_tx,
      is_extra_payment = v_extra,
      installments = case when v_kind = 'advance' then p_installments end,
      -- Una cuota de manejo automática deja de serlo al cambiar de tipo
      generated = v_entry.generated and v_kind = 'fee'
  where id = v_entry.id;

  -- El movimiento anterior que ya no corresponde, y el gasto suelto que
  -- reemplaza un pago de tarjeta
  if v_old_tx is not null and v_old_tx is distinct from v_tx then
    delete from public.transactions where id = v_old_tx;
  end if;
  if p_link_transaction_id is not null and v_link_type = 'expense'
    and v_kind = 'payment' and v_debt.kind = 'credit_card'
  then
    delete from public.transactions where id = p_link_transaction_id;
  end if;

  -- Mensual de Me deben: el cobro se reparte de nuevo desde la cuota más
  -- antigua; otro tipo suelta sus cuotas
  if v_debt.kind = 'receivable' and v_debt.schedule = 'monthly' then
    perform public.allocate_debt_entry(v_entry.id, null);
  end if;

  return v_entry.id;
end;
$$;

revoke execute on function public.update_debt_entry(uuid, text, numeric, date, time, text, uuid, boolean, boolean, smallint, text, uuid, uuid) from public, anon;
grant execute on function public.update_debt_entry(uuid, text, numeric, date, time, text, uuid, boolean, boolean, smallint, text, uuid, uuid) to authenticated;

-- 3. Conversiones sueltas ------------------------------------------------------

-- update_debt_entry cubre todo lo que hacían: la app ya no las llama
drop function public.convert_debt_adjustment(uuid, uuid, date, time, text, text, uuid, uuid);
drop function public.convert_debt_adjustment_to_charge(uuid, text, uuid, smallint, date, time, text);
