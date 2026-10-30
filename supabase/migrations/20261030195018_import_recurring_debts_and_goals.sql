-- Importar gastos fijos, pagos y ajustes de deudas y aportes a metas (SPEC
-- 08b). Cada importación tiene un solo destino (imports.target). Igual que en
-- el SPEC 08, solo las RPC security definer escriben en imports.

create type public.import_target as enum (
  'transactions', 'recurring_expenses', 'debt_entries', 'goal_contributions'
);

-- Las importaciones existentes son de movimientos
alter table public.imports
  add column target public.import_target not null default 'transactions';

alter table public.recurring_expenses
  add column import_id uuid references public.imports (id) on delete set null;
alter table public.debt_entries
  add column import_id uuid references public.imports (id) on delete set null;
alter table public.goal_contributions
  add column import_id uuid references public.imports (id) on delete set null;

create index recurring_expenses_import on public.recurring_expenses (import_id)
  where import_id is not null;
create index debt_entries_import on public.debt_entries (import_id)
  where import_id is not null;
create index goal_contributions_import on public.goal_contributions (import_id)
  where import_id is not null;

-- Validaciones comunes y creación de la fila de imports. Solo la llaman las
-- RPC de importación (corren como su dueño), no se expone.
create function public.create_import(
  p_workspace_id uuid,
  p_target public.import_target,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_rows jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'El espacio no existe'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No hay filas para importar'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Máximo 2.000 filas por importación'
      using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_stats) <> 'object' then
    raise exception 'Datos de importación inválidos'
      using errcode = 'check_violation';
  end if;

  insert into public.imports (workspace_id, target, filename, sheets, stats)
  values (p_workspace_id, p_target, p_filename, coalesce(p_sheets, '{}'), p_stats)
  returning id into v_import_id;

  return v_import_id;
end;
$$;

-- Gastos fijos. p_new_categories: [{ key, name }] (siempre de gasto). p_rows:
-- [{ name, amount, category_id | new_category_key, frequency, day_of_month,
-- month_of_year, starts_on, ends_on }]. Los check de recurring_expenses y el
-- trigger check_expense_category siguen aplicando.
create function public.import_recurring_expenses(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_new_categories jsonb,
  p_rows jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_category record;
  v_category_id uuid;
  v_category_ids jsonb := '{}'::jsonb; -- key → id de las categorías nuevas
begin
  v_import_id := public.create_import(
    p_workspace_id, 'recurring_expenses', p_filename, p_sheets, p_stats, p_rows
  );

  if jsonb_typeof(p_new_categories) <> 'array' then
    raise exception 'Datos de importación inválidos'
      using errcode = 'check_violation';
  end if;

  for v_category in
    select * from jsonb_to_recordset(p_new_categories) as c (key text, name text)
  loop
    insert into public.categories (workspace_id, type, name, icon, color)
    values (p_workspace_id, 'expense', v_category.name, 'receipt', 'slate')
    returning id into v_category_id;

    v_category_ids := v_category_ids || jsonb_build_object(v_category.key, v_category_id);
  end loop;

  insert into public.recurring_expenses (
    workspace_id, name, amount, category_id, frequency, day_of_month,
    month_of_year, starts_on, ends_on, is_active, import_id
  )
  select
    p_workspace_id,
    r.name,
    r.amount,
    coalesce(r.category_id, (v_category_ids ->> r.new_category_key)::uuid),
    r.frequency,
    r.day_of_month,
    r.month_of_year,
    r.starts_on,
    r.ends_on,
    true,
    v_import_id
  from jsonb_to_recordset(p_rows) as r (
    name text,
    amount numeric,
    category_id uuid,
    new_category_key text,
    frequency public.recurring_frequency,
    day_of_month smallint,
    month_of_year smallint,
    starts_on date,
    ends_on date
  );

  return v_import_id;
end;
$$;

-- Pagos y ajustes de deudas. p_rows: [{ debt_id, kind, amount, occurred_on,
-- note }], con amount con signo solo en ajustes. Primero entra lo que sube el
-- saldo, así check_debt_balance no falla en un estado intermedio. Con
-- p_create_transactions, cada pago de un préstamo o cuenta por cobrar crea su
-- movimiento igual que record_debt_payment. Nunca en tarjetas.
create function public.import_debt_entries(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_create_transactions boolean,
  p_rows jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_row record;
  v_type public.transaction_type;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  v_import_id := public.create_import(
    p_workspace_id, 'debt_entries', p_filename, p_sheets, p_stats, p_rows
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r (debt_id uuid)
    where not exists (
      select 1 from public.debts d
      where d.id = r.debt_id and d.workspace_id = p_workspace_id
    )
  ) then
    raise exception 'La deuda no existe'
      using errcode = 'no_data_found';
  end if;

  for v_row in
    select r.*, d.kind as debt_kind, d.name as debt_name
    from jsonb_to_recordset(p_rows) as r (
      debt_id uuid,
      kind public.debt_entry_kind,
      amount numeric,
      occurred_on date,
      note text
    )
    join public.debts d on d.id = r.debt_id
    order by (r.kind = 'adjustment' and r.amount > 0) desc, r.occurred_on
  loop
    v_transaction_id := null;

    if p_create_transactions
      and v_row.kind = 'payment'
      and v_row.debt_kind <> 'credit_card'
    then
      v_type := case v_row.debt_kind when 'loan' then 'expense' else 'income' end;

      select id into v_category_id
      from public.categories
      where workspace_id is null
        and type = v_type
        and name = case v_type when 'expense' then 'Deudas' else 'Cobros' end;

      insert into public.transactions (
        workspace_id, type, amount, category_id, occurred_on, description
      ) values (
        p_workspace_id,
        v_type,
        v_row.amount,
        v_category_id,
        v_row.occurred_on,
        case v_type when 'expense' then 'Pago ' else 'Abono ' end || v_row.debt_name
      )
      returning id into v_transaction_id;
    end if;

    insert into public.debt_entries (
      workspace_id, debt_id, kind, amount, occurred_on, note, transaction_id, import_id
    ) values (
      p_workspace_id,
      v_row.debt_id,
      v_row.kind,
      v_row.amount,
      v_row.occurred_on,
      v_row.note,
      v_transaction_id,
      v_import_id
    );
  end loop;

  return v_import_id;
end;
$$;

-- Aportes (> 0) y retiros (< 0) a metas. p_rows: [{ goal_id, amount,
-- occurred_on, note }]. Primero los aportes y luego los retiros.
create function public.import_goal_contributions(
  p_workspace_id uuid,
  p_filename text,
  p_sheets text[],
  p_stats jsonb,
  p_rows jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
begin
  v_import_id := public.create_import(
    p_workspace_id, 'goal_contributions', p_filename, p_sheets, p_stats, p_rows
  );

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r (goal_id uuid)
    where not exists (
      select 1 from public.savings_goals g
      where g.id = r.goal_id and g.workspace_id = p_workspace_id
    )
  ) then
    raise exception 'La meta no existe'
      using errcode = 'no_data_found';
  end if;

  insert into public.goal_contributions (
    workspace_id, goal_id, amount, occurred_on, note, import_id
  )
  select p_workspace_id, r.goal_id, r.amount, r.occurred_on, r.note, v_import_id
  from jsonb_to_recordset(p_rows) as r (
    goal_id uuid,
    amount numeric,
    occurred_on date,
    note text
  )
  order by (r.amount > 0) desc, r.occurred_on;

  return v_import_id;
end;
$$;

-- Deshace según el destino. Todo o nada: si una deuda o meta no está activa
-- o quedaría con saldo negativo, falla con su nombre y no borra nada. En
-- debt_entries, sync_debt_entry_transaction borra los movimientos enlazados.
create or replace function public.undo_import(p_import_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_import public.imports;
  v_deleted integer;
  v_name text;
begin
  select * into v_import
  from public.imports
  where id = p_import_id
  for update;

  if not found or not public.is_workspace_owner(v_import.workspace_id) then
    raise exception 'La importación no existe'
      using errcode = 'no_data_found';
  end if;

  if v_import.status = 'undone' then
    raise exception 'La importación ya se deshizo'
      using errcode = 'check_violation';
  end if;

  case v_import.target
    when 'transactions' then
      delete from public.transactions
      where import_id = p_import_id;

    when 'recurring_expenses' then
      delete from public.recurring_expenses
      where import_id = p_import_id;

    when 'debt_entries' then
      select d.name into v_name
      from public.debts d
      where d.status <> 'active'
        and exists (
          select 1 from public.debt_entries e
          where e.debt_id = d.id and e.import_id = p_import_id
        )
      limit 1;

      if v_name is not null then
        raise exception 'Reactiva la deuda «%» para deshacer la importación', v_name
          using errcode = 'check_violation';
      end if;

      -- saldo = inicial − pagos + ajustes; sin las entradas del import
      select d.name into v_name
      from public.debts d
      join public.debt_entries e on e.debt_id = d.id
      where d.id in (
        select debt_id from public.debt_entries where import_id = p_import_id
      )
      group by d.id, d.name, d.opening_balance
      having d.opening_balance
        + sum(case when e.import_id is distinct from p_import_id then
            case e.kind when 'payment' then -e.amount else e.amount end
          else 0 end) < 0
      limit 1;

      if v_name is not null then
        raise exception 'Deshacer dejaría la deuda «%» con saldo negativo', v_name
          using errcode = 'check_violation';
      end if;

      delete from public.debt_entries
      where import_id = p_import_id;

    when 'goal_contributions' then
      select g.name into v_name
      from public.savings_goals g
      where g.status <> 'active'
        and exists (
          select 1 from public.goal_contributions c
          where c.goal_id = g.id and c.import_id = p_import_id
        )
      limit 1;

      if v_name is not null then
        raise exception 'Reactiva la meta «%» para deshacer la importación', v_name
          using errcode = 'check_violation';
      end if;

      select g.name into v_name
      from public.savings_goals g
      join public.goal_contributions c on c.goal_id = g.id
      where g.id in (
        select goal_id from public.goal_contributions where import_id = p_import_id
      )
      group by g.id, g.name
      having sum(case when c.import_id is distinct from p_import_id then c.amount else 0 end) < 0
      limit 1;

      if v_name is not null then
        raise exception 'Deshacer dejaría la meta «%» con ahorro negativo', v_name
          using errcode = 'check_violation';
      end if;

      delete from public.goal_contributions
      where import_id = p_import_id;
  end case;

  get diagnostics v_deleted = row_count;

  update public.imports
  set status = 'undone', undone_at = now()
  where id = p_import_id;

  return v_deleted;
end;
$$;

revoke execute on function public.create_import(uuid, public.import_target, text, text[], jsonb, jsonb) from public, anon, authenticated;

revoke execute on function public.import_recurring_expenses(uuid, text, text[], jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_recurring_expenses(uuid, text, text[], jsonb, jsonb, jsonb) to authenticated;

revoke execute on function public.import_debt_entries(uuid, text, text[], jsonb, boolean, jsonb) from public, anon;
grant execute on function public.import_debt_entries(uuid, text, text[], jsonb, boolean, jsonb) to authenticated;

revoke execute on function public.import_goal_contributions(uuid, text, text[], jsonb, jsonb) from public, anon;
grant execute on function public.import_goal_contributions(uuid, text, text[], jsonb, jsonb) to authenticated;
