-- Avance de tarjeta como ingreso (SPEC 36).
--
-- Un avance hacia una cuenta registrada deja de ser solo movimiento de
-- capital: crea un ingreso en transactions (categoría de sistema "Avance de
-- tarjeta") enlazado a la entrada por debt_entries.transaction_id, igual que
-- los préstamos y las cuentas por cobrar. La cuenta pasa al movimiento: la
-- entrada advance ya no lleva account_id, así el saldo de la cuenta se cuenta
-- una sola vez (por el ingreso). Sin cuenta, el avance solo sube la deuda.
--
-- account_balances, account_balances_by_month y ledger_entries no cambian:
-- su rama de debt_entries con account_id deja de recibir avances nuevos y
-- sigue cubriendo los que la migración de datos no pueda convertir.

-- Categoría de sistema para el ingreso de un avance. No hay ícono de tarjeta
-- en CATEGORY_ICONS: se usa banknote, el más cercano
insert into public.categories (workspace_id, scope, type, name, icon, color) values
  (null, 'personal', 'income', 'Avance de tarjeta', 'banknote', 'violet');

-- check_debt_entry (SPEC 06, 16, 17, 19, 28 y 36). Cambia respecto a SPEC 28:
-- - account_id solo en pagos de tarjeta (el avance lleva la cuenta en su
--   movimiento);
-- - un avance de tarjeta admite transaction_id, y ese movimiento debe ser un
--   ingreso.
create or replace function public.check_debt_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.debt_kind;
  v_status public.debt_status;
  v_schedule public.receivable_schedule;
  v_starts_on date;
  v_term_months smallint;
  v_first_period date;
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
      and new.period_on is not distinct from old.period_on
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
      and new.period_on is not distinct from old.period_on
    then
      return new;
    end if;
  end if;

  select kind, status, schedule, starts_on, term_months
    into v_kind, v_status, v_schedule, v_starts_on, v_term_months
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

  -- Cuotas del cobro mensual
  if v_kind = 'receivable' and v_schedule = 'monthly' and new.kind = 'payment' then
    if new.period_on is null then
      raise exception 'Elige la cuota que se cobra'
        using errcode = 'check_violation';
    end if;

    v_first_period := date_trunc('month', v_starts_on::timestamp)::date;

    if new.period_on < v_first_period then
      raise exception 'La cuota es anterior al inicio del cobro'
        using errcode = 'check_violation';
    end if;

    if v_term_months is not null
      and new.period_on > (v_first_period + make_interval(months => v_term_months - 1))::date
    then
      raise exception 'La cuota es posterior a la última cuota'
        using errcode = 'check_violation';
    end if;
  elsif new.period_on is not null then
    raise exception 'Solo los cobros de una cuenta por cobrar mensual llevan cuota'
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

-- record_card_advance (SPEC 16 y 19), misma firma. Con cuenta crea el ingreso
-- y la entrada enlazada en la misma transacción; sin cuenta, solo la entrada.
drop function public.record_card_advance(uuid, numeric, date, text, uuid, time);

create function public.record_card_advance(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_account_id uuid default null,
  p_occurred_time time default null
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
    transaction_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'advance',
    p_amount,
    p_occurred_on,
    p_occurred_time,
    p_note,
    v_transaction_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time) from public, anon;
grant execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time) to authenticated;

-- Convierte los avances existentes con cuenta: cada uno recibe su ingreso y
-- la cuenta pasa al movimiento. El saldo de la cuenta no cambia (antes sumaba
-- la entrada, ahora suma el ingreso).
--
-- Fila por fila: si una viola un trigger (tarjeta pagada o archivada, cuenta
-- archivada, etc.) se reporta con raise notice y queda como estaba; sigue
-- contando en el saldo por la rama de debt_entries con account_id.
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
    select e.id, e.workspace_id, e.debt_id, e.amount, e.occurred_on,
           e.occurred_time, e.account_id, d.name as debt_name
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
      raise notice 'Avance % (tarjeta %) sin convertir: % (% el %)',
        v_row.id, v_row.debt_id, sqlerrm, v_row.amount, v_row.occurred_on;
    end;
  end loop;

  raise notice 'Avances convertidos en ingreso: %, sin convertir: %',
    v_converted, v_skipped;
end;
$$;
