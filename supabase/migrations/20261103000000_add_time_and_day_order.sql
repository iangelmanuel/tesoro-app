-- Hora opcional y orden manual dentro del día (SPEC 19).
--   occurred_time: hora local del usuario (America/Bogota), informativa. No
--                  reordena ni filtra nada.
--   day_position:  posición manual dentro de un mismo occurred_on. 0 = fila
--                  nueva (queda arriba del día); 1..n tras reordenar.
-- Orden de la lista: occurred_on desc, day_position asc, created_at desc, id.

alter table public.transactions
  add column occurred_time time,
  add column day_position integer not null default 0;

alter table public.transfers
  add column occurred_time time,
  add column day_position integer not null default 0;

alter table public.account_adjustments
  add column occurred_time time,
  add column day_position integer not null default 0;

alter table public.debt_entries
  add column occurred_time time,
  add column day_position integer not null default 0;

alter table public.goal_contributions
  add column occurred_time time,
  add column day_position integer not null default 0;

-- Cambiar la fecha de una fila la deja arriba de su día nuevo. Cubre
-- ediciones desde cualquier pantalla o RPC.
create function public.reset_day_position()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.occurred_on is distinct from old.occurred_on then
    new.day_position := 0;
  end if;

  return new;
end;
$$;

revoke execute on function public.reset_day_position() from public, anon, authenticated;

create trigger transactions_reset_day_position
  before update on public.transactions
  for each row execute function public.reset_day_position();

create trigger transfers_reset_day_position
  before update on public.transfers
  for each row execute function public.reset_day_position();

create trigger account_adjustments_reset_day_position
  before update on public.account_adjustments
  for each row execute function public.reset_day_position();

create trigger debt_entries_reset_day_position
  before update on public.debt_entries
  for each row execute function public.reset_day_position();

create trigger goal_contributions_reset_day_position
  before update on public.goal_contributions
  for each row execute function public.reset_day_position();

-- Reordenar o poner hora no cambia saldos. Los triggers de validación de
-- deudas y metas dejan pasar un update que no toca monto, fecha, nota ni
-- cuenta, así se puede reordenar una fila de una deuda cerrada o una meta
-- inactiva sin reactivarla.

-- check_debt_entry (SPEC 06, 16 y 17) con el atajo para updates inertes
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

-- check_goal_contribution (SPEC 05) con el mismo atajo
create or replace function public.check_goal_contribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.goal_status;
begin
  if tg_op = 'DELETE' then
    select status into v_status
    from public.savings_goals
    where id = old.goal_id
    for update;

    -- Sin meta: borrado en cascada desde la meta o el espacio
    if not found then
      return old;
    end if;

    if v_status <> 'active' then
      raise exception 'Reactiva la meta para registrar aportes'
        using errcode = 'check_violation';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.goal_id <> old.goal_id then
      raise exception 'Un aporte no puede cambiar de meta'
        using errcode = 'check_violation';
    end if;

    -- Solo cambian hora u orden del día: no afecta el saldo
    if new.amount = old.amount
      and new.occurred_on = old.occurred_on
      and new.note is not distinct from old.note
      and new.account_id is not distinct from old.account_id
    then
      return new;
    end if;
  end if;

  select status into v_status
  from public.savings_goals
  where id = new.goal_id
  for update;

  if not found or v_status <> 'active' then
    raise exception 'Reactiva la meta para registrar aportes'
      using errcode = 'check_violation';
  end if;

  if new.occurred_on > (now() at time zone 'America/Bogota')::date then
    raise exception 'La fecha del aporte no puede ser futura'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ledger_entries (SPEC 08c y 16): occurred_time y day_position van al final,
-- porque create or replace view solo admite columnas nuevas al final.
create or replace view public.ledger_entries
with (security_invoker = true)
as
  select t.id, t.workspace_id, t.type::text as kind, t.amount, t.occurred_on,
         t.created_at, t.account_id, null::uuid as to_account_id,
         t.category_id, t.description, t.note,
         t.counterparty, t.invoice_ref,
         t.occurred_time, t.day_position
  from public.transactions t
  union all
  select tr.id, tr.workspace_id, 'transfer', tr.amount, tr.occurred_on,
         tr.created_at, tr.from_account_id, tr.to_account_id,
         null::uuid, null::text, tr.note,
         null::text, null::text,
         tr.occurred_time, tr.day_position
  from public.transfers tr
  union all
  select a.id, a.workspace_id, 'adjustment', a.amount, a.occurred_on,
         a.created_at, a.account_id, null::uuid,
         null::uuid, null::text, a.note,
         null::text, null::text,
         a.occurred_time, a.day_position
  from public.account_adjustments a
  union all
  select e.id, e.workspace_id, 'debt_' || e.kind::text, e.amount, e.occurred_on,
         e.created_at, e.account_id, null::uuid,
         null::uuid, d.name, e.note,
         null::text, null::text,
         e.occurred_time, e.day_position
  from public.debt_entries e
  join public.debts d on d.id = e.debt_id
  where e.account_id is not null
  union all
  select c.id, c.workspace_id, 'goal_contribution', c.amount, c.occurred_on,
         c.created_at, c.account_id, null::uuid,
         null::uuid, g.name, c.note,
         null::text, null::text,
         c.occurred_time, c.day_position
  from public.goal_contributions c
  join public.savings_goals g on g.id = c.goal_id
  where c.account_id is not null;

-- move_ledger_entry: mueve una fila a la posición de otra del mismo día y
-- reasigna day_position = 1..n a todo el día del espacio (las cinco tablas)
-- en una sola sentencia. p_kind y p_target_kind son los valores de
-- ledger_entries.kind. Security invoker: RLS decide qué filas se ven y se
-- escriben; la comprobación de is_workspace_writable da un error claro en
-- lugar de un update que no afecta filas.
create function public.move_ledger_entry(
  p_workspace_id uuid,
  p_kind text,
  p_id uuid,
  p_target_kind text,
  p_target_id uuid
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_day date;
  v_target_day date;
  v_done integer;
begin
  if not public.is_workspace_writable(p_workspace_id) then
    raise exception 'No tienes permiso para modificar este espacio'
      using errcode = 'insufficient_privilege';
  end if;

  select occurred_on into v_day
  from public.ledger_entries
  where workspace_id = p_workspace_id and kind = p_kind and id = p_id;

  if not found then
    raise exception 'El movimiento no existe'
      using errcode = 'no_data_found';
  end if;

  select occurred_on into v_target_day
  from public.ledger_entries
  where workspace_id = p_workspace_id
    and kind = p_target_kind
    and id = p_target_id;

  if not found then
    raise exception 'El movimiento de destino no existe'
      using errcode = 'no_data_found';
  end if;

  if v_day <> v_target_day then
    raise exception 'Solo se puede reordenar dentro del mismo día'
      using errcode = 'check_violation';
  end if;

  if p_kind = p_target_kind and p_id = p_target_id then
    return;
  end if;

  -- Serializa reordenamientos simultáneos del mismo día
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || v_day::text, 0));

  with day as (
    select l.kind, l.id,
           row_number() over (
             order by l.day_position, l.created_at desc, l.id
           ) as rn
    from public.ledger_entries l
    where l.workspace_id = p_workspace_id
      and l.occurred_on = v_day
  ),
  src as (
    select rn from day where kind = p_kind and id = p_id
  ),
  tgt as (
    select rn from day where kind = p_target_kind and id = p_target_id
  ),
  -- La fila origen toma la posición del destino: baja pasa después de él, sube
  -- pasa antes
  keyed as (
    select d.kind, d.id,
           case
             when d.kind = p_kind and d.id = p_id then
               tgt.rn + case when src.rn < tgt.rn then 0.5 else -0.5 end
             else d.rn::numeric
           end as sort_key
    from day d, src, tgt
  ),
  ordered as (
    select k.kind, k.id,
           row_number() over (order by k.sort_key) as pos
    from keyed k
  ),
  u_transactions as (
    update public.transactions t
    set day_position = o.pos
    from ordered o
    where o.kind in ('income', 'expense')
      and o.id = t.id
      and t.workspace_id = p_workspace_id
      and t.day_position is distinct from o.pos
    returning t.id
  ),
  u_transfers as (
    update public.transfers t
    set day_position = o.pos
    from ordered o
    where o.kind = 'transfer'
      and o.id = t.id
      and t.workspace_id = p_workspace_id
      and t.day_position is distinct from o.pos
    returning t.id
  ),
  u_adjustments as (
    update public.account_adjustments a
    set day_position = o.pos
    from ordered o
    where o.kind = 'adjustment'
      and o.id = a.id
      and a.workspace_id = p_workspace_id
      and a.day_position is distinct from o.pos
    returning a.id
  ),
  u_debt_entries as (
    update public.debt_entries e
    set day_position = o.pos
    from ordered o
    where o.kind like 'debt\_%'
      and o.id = e.id
      and e.workspace_id = p_workspace_id
      and e.day_position is distinct from o.pos
    returning e.id
  ),
  u_goal_contributions as (
    update public.goal_contributions c
    set day_position = o.pos
    from ordered o
    where o.kind = 'goal_contribution'
      and o.id = c.id
      and c.workspace_id = p_workspace_id
      and c.day_position is distinct from o.pos
    returning c.id
  )
  select 1 into v_done;
end;
$$;

revoke execute on function public.move_ledger_entry(uuid, text, uuid, text, uuid) from public, anon;
grant execute on function public.move_ledger_entry(uuid, text, uuid, text, uuid) to authenticated;

-- RPC de registro con hora opcional. El parámetro nuevo va al final con
-- default null. Al cambiar la firma hay que recrear cada función.

-- Traspaso previo al pago, con la misma hora del pago
drop function public.create_payment_transfer(uuid, uuid, uuid, numeric, date);

create function public.create_payment_transfer(
  p_workspace_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_occurred_on date,
  p_occurred_time time default null
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_to is null then
    raise exception 'El traspaso necesita una cuenta de destino'
      using errcode = 'check_violation';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del traspaso debe ser mayor a cero'
      using errcode = 'check_violation';
  end if;

  insert into public.transfers (
    workspace_id, from_account_id, to_account_id, amount, occurred_on,
    occurred_time
  ) values (
    p_workspace_id, p_from, p_to, p_amount, p_occurred_on, p_occurred_time
  );
end;
$$;

revoke execute on function public.create_payment_transfer(uuid, uuid, uuid, numeric, date, time) from public, anon, authenticated;

drop function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric);

create function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_create_transaction boolean,
  p_account_id uuid default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null,
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
      case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_debt.name,
      p_account_id
    )
    returning id into v_transaction_id;
  elsif v_debt.kind = 'credit_card' then
    v_entry_account_id := p_account_id;
  end if;

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, occurred_time, note,
    transaction_id, account_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'payment',
    p_amount,
    p_occurred_on,
    p_occurred_time,
    p_note,
    v_transaction_id,
    v_entry_account_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

drop function public.record_card_advance(uuid, numeric, date, text, uuid);

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

  insert into public.debt_entries (
    workspace_id, debt_id, kind, amount, occurred_on, occurred_time, note,
    account_id
  ) values (
    v_debt.workspace_id,
    v_debt.id,
    'advance',
    p_amount,
    p_occurred_on,
    p_occurred_time,
    p_note,
    p_account_id
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

drop function public.record_goal_contribution(uuid, numeric, date, text, uuid, uuid, numeric);

create function public.record_goal_contribution(
  p_goal_id uuid,
  p_amount numeric,
  p_occurred_on date,
  p_note text,
  p_account_id uuid default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null,
  p_occurred_time time default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.savings_goals
  where id = p_goal_id;

  if not found then
    raise exception 'La meta no existe'
      using errcode = 'no_data_found';
  end if;

  if p_transfer_from is not null and p_amount > 0 then
    perform public.create_payment_transfer(
      v_workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on, p_occurred_time
    );
  end if;

  insert into public.goal_contributions (
    workspace_id, goal_id, amount, occurred_on, occurred_time, note,
    account_id
  ) values (
    v_workspace_id, p_goal_id, p_amount, p_occurred_on, p_occurred_time,
    p_note, p_account_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop function public.record_transaction(uuid, public.transaction_type, numeric, uuid, date, text, text, uuid, uuid, date, text, text, uuid, numeric);

create function public.record_transaction(
  p_workspace_id uuid,
  p_type public.transaction_type,
  p_amount numeric,
  p_category_id uuid,
  p_occurred_on date,
  p_description text,
  p_note text default null,
  p_account_id uuid default null,
  p_recurring_expense_id uuid default null,
  p_recurring_due_on date default null,
  p_counterparty text default null,
  p_invoice_ref text default null,
  p_transfer_from uuid default null,
  p_transfer_amount numeric default null,
  p_occurred_time time default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_transfer_from is not null then
    if p_type <> 'expense' then
      raise exception 'Solo un gasto admite traspaso al registrar'
        using errcode = 'check_violation';
    end if;

    perform public.create_payment_transfer(
      p_workspace_id, p_transfer_from, p_account_id,
      p_transfer_amount, p_occurred_on, p_occurred_time
    );
  end if;

  insert into public.transactions (
    workspace_id, type, amount, category_id, occurred_on, occurred_time,
    description, note, account_id, recurring_expense_id, recurring_due_on,
    counterparty, invoice_ref
  ) values (
    p_workspace_id, p_type, p_amount, p_category_id, p_occurred_on,
    p_occurred_time, p_description, p_note, p_account_id,
    p_recurring_expense_id, p_recurring_due_on, p_counterparty, p_invoice_ref
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, date, text, boolean, uuid, uuid, numeric, time) to authenticated;

revoke execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time) from public, anon;
grant execute on function public.record_card_advance(uuid, numeric, date, text, uuid, time) to authenticated;

revoke execute on function public.record_goal_contribution(uuid, numeric, date, text, uuid, uuid, numeric, time) from public, anon;
grant execute on function public.record_goal_contribution(uuid, numeric, date, text, uuid, uuid, numeric, time) to authenticated;

revoke execute on function public.record_transaction(uuid, public.transaction_type, numeric, uuid, date, text, text, uuid, uuid, date, text, text, uuid, numeric, time) from public, anon;
grant execute on function public.record_transaction(uuid, public.transaction_type, numeric, uuid, date, text, text, uuid, uuid, date, text, text, uuid, numeric, time) to authenticated;
