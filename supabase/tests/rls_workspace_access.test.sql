-- Acceso por espacio con RLS (SPEC 56a). Caracteriza qué puede leer y
-- escribir un usuario en cada tabla con workspace_id. Sirve para reescribir
-- las políticas sin cambiar el acceso: corre igual antes y después.
--
-- Fixtures (como postgres, sin RLS):
--   - Usuario A con su Personal (a_personal) y una Empresa marcada para
--     borrar (a_marked).
--   - Usuario B con su Personal (b_personal).
--   - Una fila (o más) de cada tabla en cada uno de los tres espacios.
--
-- Luego, como A (rol authenticated), en cada tabla y cada espacio se prueba
-- leer, insertar (copia de la fila semilla con id nuevo), actualizar (no-op)
-- y borrar. Cada escritura corre en un subbloque que se deshace, así una no
-- afecta a la siguiente. El resultado se compara con la matriz esperada:
--   - visible / hidden: la lectura devuelve filas o no
--   - ok: la escritura afectó filas
--   - none: RLS filtró todas las filas (update o delete sin efecto)
--   - 42501: RLS rechazó la fila (insert o with check)
--   - otro SQLSTATE: falló otra regla. Postgres corre los triggers BEFORE,
--     luego el with check de RLS y al final las restricciones, así que:
--     23505 / 23503 (unique, FK) = RLS dejó pasar la fila;
--     23514 de un trigger = el trigger la rechazó antes de llegar a RLS
--     (pasa al copiar una fila de B: el trigger no ve su categoría o cuenta)
--   - no-seed: la tabla no existe en ese tipo de espacio
--
-- Si un resultado cambia, el acceso cambió: no se edita la matriz para que
-- pase, se revisa la política.
--
-- Correr: supabase start && supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Infraestructura de la prueba ------------------------------------------------

create schema rls_test;
grant usage on schema rls_test to authenticated;

create table rls_test.ctx (label text primary key, id uuid not null);

create table rls_test.templates (
  table_name text not null,
  ws text not null,
  row_data jsonb not null,
  primary key (table_name, ws)
);

create table rls_test.observed (
  table_name text not null,
  ws text not null,
  op text not null,
  result text not null,
  primary key (table_name, ws, op)
);

grant select on rls_test.ctx, rls_test.templates to authenticated;
grant insert, select on rls_test.observed to authenticated;

-- Tablas con workspace_id, en el orden en que se reportan
create table rls_test.tables (table_name text primary key);
insert into rls_test.tables values
  ('account_adjustments'), ('accounts'), ('budgets'), ('business_profiles'),
  ('categories'), ('debt_entries'), ('debt_entry_allocations'), ('debts'),
  ('dismissed_recommendations'), ('goal_contributions'), ('imports'),
  ('mcp_operations'), ('receivable_installment_history'),
  ('recurring_expenses'), ('recurring_income_allocations'),
  ('recurring_incomes'), ('savings_goals'), ('transactions'), ('transfers');
grant select on rls_test.tables to authenticated;

-- Ejecuta una escritura y la deshace. Devuelve ok / none / SQLSTATE.
create function rls_test.try(p_sql text)
returns text
language plpgsql
as $$
declare
  v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    raise exception using errcode = 'RLSOK', message = v_rows::text;
  exception
    when sqlstate 'RLSOK' then
      return case when sqlerrm = '0' then 'none' else 'ok' end;
    when others then
      return sqlstate;
  end;
end;
$$;

-- Corre la matriz como el usuario actual y la guarda en observed
create function rls_test.observe()
returns void
language plpgsql
as $$
declare
  v_table text;
  v_ws record;
  v_count bigint;
  v_template jsonb;
begin
  for v_table in select table_name from rls_test.tables order by 1 loop
    for v_ws in
      select label, id from rls_test.ctx where label like '%\_ws' order by 1
    loop
      execute format(
        'select count(*) from public.%I where workspace_id = $1', v_table
      ) into v_count using v_ws.id;
      insert into rls_test.observed
      values (v_table, v_ws.label, 'select',
        case when v_count > 0 then 'visible' else 'hidden' end);

      select row_data into v_template
      from rls_test.templates
      where table_name = v_table and ws = v_ws.label;

      insert into rls_test.observed
      values (v_table, v_ws.label, 'insert', case
        when v_template is null then 'no-seed'
        else rls_test.try(format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, %L::jsonb)',
          v_table, v_table, v_template || jsonb_build_object('id', gen_random_uuid())
        ))
      end);

      insert into rls_test.observed
      values (v_table, v_ws.label, 'update', rls_test.try(format(
        'update public.%I set workspace_id = workspace_id where workspace_id = %L',
        v_table, v_ws.id
      )));

      insert into rls_test.observed
      values (v_table, v_ws.label, 'delete', rls_test.try(format(
        'delete from public.%I where workspace_id = %L', v_table, v_ws.id
      )));
    end loop;
  end loop;
end;
$$;

grant execute on all functions in schema rls_test to authenticated;

-- Fixtures --------------------------------------------------------------------

insert into rls_test.ctx (label, id) values
  ('a_user', 'a0000000-0000-4000-8000-000000000001'),
  ('b_user', 'b0000000-0000-4000-8000-000000000002');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', label || '@rls.test', '', '{}', '{}', now(), now()
from rls_test.ctx;

-- El registro crea el Personal de cada uno
insert into rls_test.ctx (label, id)
select 'a_personal_ws', id from public.workspaces
where owner_id = 'a0000000-0000-4000-8000-000000000001' and type = 'personal';

insert into rls_test.ctx (label, id)
select 'b_personal_ws', id from public.workspaces
where owner_id = 'b0000000-0000-4000-8000-000000000002' and type = 'personal';

with created as (
  insert into public.workspaces (owner_id, type, name)
  values ('a0000000-0000-4000-8000-000000000001', 'business', 'Empresa A')
  returning id
)
insert into rls_test.ctx (label, id) select 'a_marked_ws', id from created;

-- Una fila de cada tabla en el espacio
create function rls_test.seed(p_ws uuid, p_owner uuid, p_business boolean)
returns void
language plpgsql
as $$
declare
  v_account uuid;
  v_account2 uuid;
  v_expense uuid;
  v_income uuid;
  v_import uuid;
  v_goal uuid;
  v_card uuid;
  v_receivable uuid;
  v_recurring_income uuid;
  v_receivable_payment uuid;
begin
  insert into public.accounts (workspace_id, name, kind, icon, color)
  values (p_ws, 'Cuenta RLS 1', 'bank', 'wallet', 'slate')
  returning id into v_account;
  insert into public.accounts (workspace_id, name, kind, icon, color)
  values (p_ws, 'Cuenta RLS 2', 'cash', 'wallet', 'slate')
  returning id into v_account2;

  insert into public.categories (workspace_id, type, name, icon, color)
  values (p_ws, 'expense', 'Gasto RLS', 'receipt', 'slate')
  returning id into v_expense;
  insert into public.categories (workspace_id, type, name, icon, color)
  values (p_ws, 'income', 'Ingreso RLS', 'coins', 'lime')
  returning id into v_income;

  if p_business then
    insert into public.business_profiles (workspace_id, sector)
    values (p_ws, 'services');
  end if;

  insert into public.imports (workspace_id, filename, stats)
  values (p_ws, 'rls.csv', '{}')
  returning id into v_import;

  insert into public.transactions (
    workspace_id, type, amount, category_id, occurred_on, description,
    account_id, import_id
  )
  values (
    p_ws, 'expense', 1000, v_expense, '2026-01-10', 'Gasto RLS', v_account,
    v_import
  );

  insert into public.account_adjustments (workspace_id, account_id, amount, occurred_on)
  values (p_ws, v_account, 500, '2026-01-11');

  insert into public.transfers (
    workspace_id, from_account_id, to_account_id, amount, occurred_on
  )
  values (p_ws, v_account, v_account2, 100, '2026-01-12');

  insert into public.budgets (workspace_id, category_id, month, amount)
  values (p_ws, v_expense, '2026-01-01', 5000);

  insert into public.savings_goals (workspace_id, name, target_amount, icon, color)
  values (p_ws, 'Meta RLS', 10000, 'target', 'slate')
  returning id into v_goal;

  insert into public.goal_contributions (workspace_id, goal_id, amount, occurred_on)
  values (p_ws, v_goal, 200, '2026-01-13');

  insert into public.debts (
    workspace_id, kind, name, opening_balance, credit_limit, due_day
  )
  values (p_ws, 'credit_card', 'Tarjeta RLS', 1000, 5000, 10)
  returning id into v_card;

  insert into public.debt_entries (workspace_id, debt_id, kind, amount, occurred_on)
  values (p_ws, v_card, 'payment', 100, '2026-01-14');

  -- Cobro mensual sin número de cuotas: el único que guarda historial
  insert into public.debts (
    workspace_id, kind, name, opening_balance, schedule, installment,
    due_day, starts_on
  )
  values (p_ws, 'receivable', 'Cobro RLS', 0, 'monthly', 100, 5, '2026-01-01')
  returning id into v_receivable;

  insert into public.debt_entries (workspace_id, debt_id, kind, amount, occurred_on)
  values (p_ws, v_receivable, 'payment', 100, '2026-01-15')
  returning id into v_receivable_payment;

  insert into public.debt_entry_allocations (workspace_id, entry_id, period_on, amount)
  values (p_ws, v_receivable_payment, '2026-01-01', 100);

  insert into public.receivable_installment_history (
    workspace_id, debt_id, through_period, amount
  )
  values (p_ws, v_receivable, '2026-01-01', 100);

  insert into public.recurring_expenses (
    workspace_id, name, amount, category_id, frequency, day_of_month, starts_on
  )
  values (p_ws, 'Fijo RLS', 300, v_expense, 'monthly', 5, '2026-01-01');

  -- Los ingresos fijos solo existen en Personal
  if not p_business then
    insert into public.recurring_incomes (
      workspace_id, name, amount, category_id, frequency, day_of_month, starts_on
    )
    values (p_ws, 'Ingreso fijo RLS', 2000, v_income, 'monthly', 15, '2026-01-01')
    returning id into v_recurring_income;

    insert into public.transactions (
      workspace_id, type, amount, category_id, occurred_on, description,
      recurring_income_id
    )
    values (
      p_ws, 'income', 2000, v_income, '2026-01-15', 'Ingreso RLS',
      v_recurring_income
    );
  end if;

  insert into public.dismissed_recommendations (workspace_id, rule, entity_key, month)
  values (p_ws, 'deficit', 'rls', '2026-01-01');

  insert into public.mcp_operations (
    user_id, workspace_id, client_id, tool, summary, row_count
  )
  values (p_owner, p_ws, 'rls-test', 'create_transaction', 'RLS', 1);
end;
$$;

select rls_test.seed(
  (select id from rls_test.ctx where label = 'a_personal_ws'),
  'a0000000-0000-4000-8000-000000000001', false
);
select rls_test.seed(
  (select id from rls_test.ctx where label = 'a_marked_ws'),
  'a0000000-0000-4000-8000-000000000001', true
);
select rls_test.seed(
  (select id from rls_test.ctx where label = 'b_personal_ws'),
  'b0000000-0000-4000-8000-000000000002', false
);

-- La Empresa de A queda marcada para borrar después de sembrarla
update public.workspaces set deletion_requested_at = now()
where id = (select id from rls_test.ctx where label = 'a_marked_ws');

-- Plantilla de inserción: una fila semilla de cada tabla en cada espacio
do $$
declare
  v_table text;
  v_ws record;
begin
  for v_table in select table_name from rls_test.tables loop
    for v_ws in select label, id from rls_test.ctx where label like '%\_ws' loop
      execute format(
        'insert into rls_test.templates
         select %L, %L, to_jsonb(t) from public.%I t
         where workspace_id = %L order by created_at desc limit 1',
        v_table, v_ws.label, v_table, v_ws.id
      );
    end loop;
  end loop;
end;
$$;

-- Toda tabla tiene su fila semilla en cada espacio, salvo las que el esquema
-- limita a un tipo de espacio (perfil de empresa; ingresos fijos en Personal)
select set_eq(
  $$ select t.table_name || ' · ' || c.label
     from rls_test.tables t cross join rls_test.ctx c
     where c.label like '%\_ws'
       and not exists (
         select 1 from rls_test.templates x
         where x.table_name = t.table_name and x.ws = c.label
       ) $$,
  $$ values
       ('business_profiles · a_personal_ws'),
       ('business_profiles · b_personal_ws'),
       ('recurring_income_allocations · a_marked_ws'),
       ('recurring_incomes · a_marked_ws') $$,
  'cada tabla tiene su fila semilla en los espacios donde existe'
);

-- Toda tabla de public con workspace_id está en la lista
select set_eq(
  $$ select c.table_name::text from information_schema.columns c
     join information_schema.tables t using (table_schema, table_name)
     where c.table_schema = 'public' and c.column_name = 'workspace_id'
       and t.table_type = 'BASE TABLE' $$,
  $$ select table_name from rls_test.tables $$,
  'la prueba cubre todas las tablas con workspace_id'
);

-- Matriz como el usuario A ----------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select rls_test.observe();

reset role;

-- Matriz esperada (acceso de hoy). Formato: tabla, espacio, operación, resultado
create table rls_test.expected (
  table_name text not null,
  ws text not null,
  op text not null,
  result text not null,
  primary key (table_name, ws, op)
);

insert into rls_test.expected (table_name, ws, op, result) values
  ('account_adjustments', 'a_marked_ws', 'select', 'visible'),
  ('account_adjustments', 'a_marked_ws', 'insert', '42501'),
  ('account_adjustments', 'a_marked_ws', 'update', 'none'),
  ('account_adjustments', 'a_marked_ws', 'delete', 'none'),
  ('account_adjustments', 'a_personal_ws', 'select', 'visible'),
  ('account_adjustments', 'a_personal_ws', 'insert', 'ok'),
  ('account_adjustments', 'a_personal_ws', 'update', 'ok'),
  ('account_adjustments', 'a_personal_ws', 'delete', 'ok'),
  ('account_adjustments', 'b_personal_ws', 'select', 'hidden'),
  ('account_adjustments', 'b_personal_ws', 'insert', '42501'),
  ('account_adjustments', 'b_personal_ws', 'update', 'none'),
  ('account_adjustments', 'b_personal_ws', 'delete', 'none'),

  ('accounts', 'a_marked_ws', 'select', 'visible'),
  ('accounts', 'a_marked_ws', 'insert', '42501'),
  ('accounts', 'a_marked_ws', 'update', 'none'),
  ('accounts', 'a_marked_ws', 'delete', 'none'),
  ('accounts', 'a_personal_ws', 'select', 'visible'),
  ('accounts', 'a_personal_ws', 'insert', '23505'),
  ('accounts', 'a_personal_ws', 'update', 'ok'),
  ('accounts', 'a_personal_ws', 'delete', '23503'),
  ('accounts', 'b_personal_ws', 'select', 'hidden'),
  ('accounts', 'b_personal_ws', 'insert', '42501'),
  ('accounts', 'b_personal_ws', 'update', 'none'),
  ('accounts', 'b_personal_ws', 'delete', 'none'),

  ('budgets', 'a_marked_ws', 'select', 'visible'),
  ('budgets', 'a_marked_ws', 'insert', '23505'),
  ('budgets', 'a_marked_ws', 'update', 'ok'),
  ('budgets', 'a_marked_ws', 'delete', 'ok'),
  ('budgets', 'a_personal_ws', 'select', 'visible'),
  ('budgets', 'a_personal_ws', 'insert', '23505'),
  ('budgets', 'a_personal_ws', 'update', 'ok'),
  ('budgets', 'a_personal_ws', 'delete', 'ok'),
  ('budgets', 'b_personal_ws', 'select', 'hidden'),
  ('budgets', 'b_personal_ws', 'insert', '23514'),
  ('budgets', 'b_personal_ws', 'update', 'none'),
  ('budgets', 'b_personal_ws', 'delete', 'none'),

  ('business_profiles', 'a_marked_ws', 'select', 'visible'),
  ('business_profiles', 'a_marked_ws', 'insert', '42501'),
  ('business_profiles', 'a_marked_ws', 'update', 'none'),
  ('business_profiles', 'a_marked_ws', 'delete', 'none'),
  ('business_profiles', 'a_personal_ws', 'select', 'hidden'),
  ('business_profiles', 'a_personal_ws', 'insert', 'no-seed'),
  ('business_profiles', 'a_personal_ws', 'update', 'none'),
  ('business_profiles', 'a_personal_ws', 'delete', 'none'),
  ('business_profiles', 'b_personal_ws', 'select', 'hidden'),
  ('business_profiles', 'b_personal_ws', 'insert', 'no-seed'),
  ('business_profiles', 'b_personal_ws', 'update', 'none'),
  ('business_profiles', 'b_personal_ws', 'delete', 'none'),

  ('categories', 'a_marked_ws', 'select', 'visible'),
  ('categories', 'a_marked_ws', 'insert', '42501'),
  ('categories', 'a_marked_ws', 'update', 'none'),
  ('categories', 'a_marked_ws', 'delete', 'none'),
  ('categories', 'a_personal_ws', 'select', 'visible'),
  ('categories', 'a_personal_ws', 'insert', '23505'),
  ('categories', 'a_personal_ws', 'update', 'ok'),
  ('categories', 'a_personal_ws', 'delete', 'none'),
  ('categories', 'b_personal_ws', 'select', 'hidden'),
  ('categories', 'b_personal_ws', 'insert', '42501'),
  ('categories', 'b_personal_ws', 'update', 'none'),
  ('categories', 'b_personal_ws', 'delete', 'none'),

  ('debt_entries', 'a_marked_ws', 'select', 'visible'),
  ('debt_entries', 'a_marked_ws', 'insert', 'ok'),
  ('debt_entries', 'a_marked_ws', 'update', 'ok'),
  ('debt_entries', 'a_marked_ws', 'delete', 'ok'),
  ('debt_entries', 'a_personal_ws', 'select', 'visible'),
  ('debt_entries', 'a_personal_ws', 'insert', 'ok'),
  ('debt_entries', 'a_personal_ws', 'update', 'ok'),
  ('debt_entries', 'a_personal_ws', 'delete', 'ok'),
  ('debt_entries', 'b_personal_ws', 'select', 'hidden'),
  ('debt_entries', 'b_personal_ws', 'insert', '23514'),
  ('debt_entries', 'b_personal_ws', 'update', 'none'),
  ('debt_entries', 'b_personal_ws', 'delete', 'none'),

  ('debt_entry_allocations', 'a_marked_ws', 'select', 'visible'),
  ('debt_entry_allocations', 'a_marked_ws', 'insert', '42501'),
  ('debt_entry_allocations', 'a_marked_ws', 'update', 'none'),
  ('debt_entry_allocations', 'a_marked_ws', 'delete', 'none'),
  ('debt_entry_allocations', 'a_personal_ws', 'select', 'visible'),
  ('debt_entry_allocations', 'a_personal_ws', 'insert', '23505'),
  ('debt_entry_allocations', 'a_personal_ws', 'update', 'ok'),
  ('debt_entry_allocations', 'a_personal_ws', 'delete', 'ok'),
  ('debt_entry_allocations', 'b_personal_ws', 'select', 'hidden'),
  ('debt_entry_allocations', 'b_personal_ws', 'insert', '23514'),
  ('debt_entry_allocations', 'b_personal_ws', 'update', 'none'),
  ('debt_entry_allocations', 'b_personal_ws', 'delete', 'none'),

  ('debts', 'a_marked_ws', 'select', 'visible'),
  ('debts', 'a_marked_ws', 'insert', 'ok'),
  ('debts', 'a_marked_ws', 'update', 'ok'),
  ('debts', 'a_marked_ws', 'delete', 'none'),
  ('debts', 'a_personal_ws', 'select', 'visible'),
  ('debts', 'a_personal_ws', 'insert', 'ok'),
  ('debts', 'a_personal_ws', 'update', 'ok'),
  ('debts', 'a_personal_ws', 'delete', 'none'),
  ('debts', 'b_personal_ws', 'select', 'hidden'),
  ('debts', 'b_personal_ws', 'insert', '42501'),
  ('debts', 'b_personal_ws', 'update', 'none'),
  ('debts', 'b_personal_ws', 'delete', 'none'),

  ('dismissed_recommendations', 'a_marked_ws', 'select', 'visible'),
  ('dismissed_recommendations', 'a_marked_ws', 'insert', '42501'),
  ('dismissed_recommendations', 'a_marked_ws', 'update', 'none'),
  ('dismissed_recommendations', 'a_marked_ws', 'delete', 'none'),
  ('dismissed_recommendations', 'a_personal_ws', 'select', 'visible'),
  ('dismissed_recommendations', 'a_personal_ws', 'insert', '23505'),
  ('dismissed_recommendations', 'a_personal_ws', 'update', 'none'),
  ('dismissed_recommendations', 'a_personal_ws', 'delete', 'ok'),
  ('dismissed_recommendations', 'b_personal_ws', 'select', 'hidden'),
  ('dismissed_recommendations', 'b_personal_ws', 'insert', '42501'),
  ('dismissed_recommendations', 'b_personal_ws', 'update', 'none'),
  ('dismissed_recommendations', 'b_personal_ws', 'delete', 'none'),

  ('goal_contributions', 'a_marked_ws', 'select', 'visible'),
  ('goal_contributions', 'a_marked_ws', 'insert', 'ok'),
  ('goal_contributions', 'a_marked_ws', 'update', 'ok'),
  ('goal_contributions', 'a_marked_ws', 'delete', 'ok'),
  ('goal_contributions', 'a_personal_ws', 'select', 'visible'),
  ('goal_contributions', 'a_personal_ws', 'insert', 'ok'),
  ('goal_contributions', 'a_personal_ws', 'update', 'ok'),
  ('goal_contributions', 'a_personal_ws', 'delete', 'ok'),
  ('goal_contributions', 'b_personal_ws', 'select', 'hidden'),
  ('goal_contributions', 'b_personal_ws', 'insert', '23514'),
  ('goal_contributions', 'b_personal_ws', 'update', 'none'),
  ('goal_contributions', 'b_personal_ws', 'delete', 'none'),

  ('imports', 'a_marked_ws', 'select', 'visible'),
  ('imports', 'a_marked_ws', 'insert', '42501'),
  ('imports', 'a_marked_ws', 'update', 'none'),
  ('imports', 'a_marked_ws', 'delete', 'none'),
  ('imports', 'a_personal_ws', 'select', 'visible'),
  ('imports', 'a_personal_ws', 'insert', '42501'),
  ('imports', 'a_personal_ws', 'update', 'none'),
  ('imports', 'a_personal_ws', 'delete', 'none'),
  ('imports', 'b_personal_ws', 'select', 'hidden'),
  ('imports', 'b_personal_ws', 'insert', '42501'),
  ('imports', 'b_personal_ws', 'update', 'none'),
  ('imports', 'b_personal_ws', 'delete', 'none'),

  ('mcp_operations', 'a_marked_ws', 'select', 'visible'),
  ('mcp_operations', 'a_marked_ws', 'insert', 'ok'),
  ('mcp_operations', 'a_marked_ws', 'update', 'ok'),
  ('mcp_operations', 'a_marked_ws', 'delete', 'ok'),
  ('mcp_operations', 'a_personal_ws', 'select', 'visible'),
  ('mcp_operations', 'a_personal_ws', 'insert', 'ok'),
  ('mcp_operations', 'a_personal_ws', 'update', 'ok'),
  ('mcp_operations', 'a_personal_ws', 'delete', 'ok'),
  ('mcp_operations', 'b_personal_ws', 'select', 'hidden'),
  ('mcp_operations', 'b_personal_ws', 'insert', '42501'),
  ('mcp_operations', 'b_personal_ws', 'update', 'none'),
  ('mcp_operations', 'b_personal_ws', 'delete', 'none'),

  ('receivable_installment_history', 'a_marked_ws', 'select', 'visible'),
  ('receivable_installment_history', 'a_marked_ws', 'insert', '42501'),
  ('receivable_installment_history', 'a_marked_ws', 'update', 'none'),
  ('receivable_installment_history', 'a_marked_ws', 'delete', 'none'),
  ('receivable_installment_history', 'a_personal_ws', 'select', 'visible'),
  ('receivable_installment_history', 'a_personal_ws', 'insert', '23505'),
  ('receivable_installment_history', 'a_personal_ws', 'update', 'ok'),
  ('receivable_installment_history', 'a_personal_ws', 'delete', 'ok'),
  ('receivable_installment_history', 'b_personal_ws', 'select', 'hidden'),
  ('receivable_installment_history', 'b_personal_ws', 'insert', '23514'),
  ('receivable_installment_history', 'b_personal_ws', 'update', 'none'),
  ('receivable_installment_history', 'b_personal_ws', 'delete', 'none'),

  ('recurring_expenses', 'a_marked_ws', 'select', 'visible'),
  ('recurring_expenses', 'a_marked_ws', 'insert', 'ok'),
  ('recurring_expenses', 'a_marked_ws', 'update', 'ok'),
  ('recurring_expenses', 'a_marked_ws', 'delete', 'ok'),
  ('recurring_expenses', 'a_personal_ws', 'select', 'visible'),
  ('recurring_expenses', 'a_personal_ws', 'insert', 'ok'),
  ('recurring_expenses', 'a_personal_ws', 'update', 'ok'),
  ('recurring_expenses', 'a_personal_ws', 'delete', 'ok'),
  ('recurring_expenses', 'b_personal_ws', 'select', 'hidden'),
  ('recurring_expenses', 'b_personal_ws', 'insert', '23514'),
  ('recurring_expenses', 'b_personal_ws', 'update', 'none'),
  ('recurring_expenses', 'b_personal_ws', 'delete', 'none'),

  ('recurring_income_allocations', 'a_marked_ws', 'select', 'hidden'),
  ('recurring_income_allocations', 'a_marked_ws', 'insert', 'no-seed'),
  ('recurring_income_allocations', 'a_marked_ws', 'update', 'none'),
  ('recurring_income_allocations', 'a_marked_ws', 'delete', 'none'),
  ('recurring_income_allocations', 'a_personal_ws', 'select', 'visible'),
  ('recurring_income_allocations', 'a_personal_ws', 'insert', '23505'),
  ('recurring_income_allocations', 'a_personal_ws', 'update', 'ok'),
  ('recurring_income_allocations', 'a_personal_ws', 'delete', 'ok'),
  ('recurring_income_allocations', 'b_personal_ws', 'select', 'hidden'),
  ('recurring_income_allocations', 'b_personal_ws', 'insert', '23514'),
  ('recurring_income_allocations', 'b_personal_ws', 'update', 'none'),
  ('recurring_income_allocations', 'b_personal_ws', 'delete', 'none'),

  ('recurring_incomes', 'a_marked_ws', 'select', 'hidden'),
  ('recurring_incomes', 'a_marked_ws', 'insert', 'no-seed'),
  ('recurring_incomes', 'a_marked_ws', 'update', 'none'),
  ('recurring_incomes', 'a_marked_ws', 'delete', 'none'),
  ('recurring_incomes', 'a_personal_ws', 'select', 'visible'),
  ('recurring_incomes', 'a_personal_ws', 'insert', 'ok'),
  ('recurring_incomes', 'a_personal_ws', 'update', 'ok'),
  ('recurring_incomes', 'a_personal_ws', 'delete', 'ok'),
  ('recurring_incomes', 'b_personal_ws', 'select', 'hidden'),
  ('recurring_incomes', 'b_personal_ws', 'insert', '23514'),
  ('recurring_incomes', 'b_personal_ws', 'update', 'none'),
  ('recurring_incomes', 'b_personal_ws', 'delete', 'none'),

  ('savings_goals', 'a_marked_ws', 'select', 'visible'),
  ('savings_goals', 'a_marked_ws', 'insert', 'ok'),
  ('savings_goals', 'a_marked_ws', 'update', 'ok'),
  ('savings_goals', 'a_marked_ws', 'delete', 'none'),
  ('savings_goals', 'a_personal_ws', 'select', 'visible'),
  ('savings_goals', 'a_personal_ws', 'insert', 'ok'),
  ('savings_goals', 'a_personal_ws', 'update', 'ok'),
  ('savings_goals', 'a_personal_ws', 'delete', 'none'),
  ('savings_goals', 'b_personal_ws', 'select', 'hidden'),
  ('savings_goals', 'b_personal_ws', 'insert', '42501'),
  ('savings_goals', 'b_personal_ws', 'update', 'none'),
  ('savings_goals', 'b_personal_ws', 'delete', 'none'),

  ('transactions', 'a_marked_ws', 'select', 'visible'),
  ('transactions', 'a_marked_ws', 'insert', '42501'),
  ('transactions', 'a_marked_ws', 'update', 'none'),
  ('transactions', 'a_marked_ws', 'delete', 'none'),
  ('transactions', 'a_personal_ws', 'select', 'visible'),
  ('transactions', 'a_personal_ws', 'insert', 'ok'),
  ('transactions', 'a_personal_ws', 'update', 'ok'),
  ('transactions', 'a_personal_ws', 'delete', 'ok'),
  ('transactions', 'b_personal_ws', 'select', 'hidden'),
  ('transactions', 'b_personal_ws', 'insert', '23514'),
  ('transactions', 'b_personal_ws', 'update', 'none'),
  ('transactions', 'b_personal_ws', 'delete', 'none'),

  ('transfers', 'a_marked_ws', 'select', 'visible'),
  ('transfers', 'a_marked_ws', 'insert', '42501'),
  ('transfers', 'a_marked_ws', 'update', 'none'),
  ('transfers', 'a_marked_ws', 'delete', 'none'),
  ('transfers', 'a_personal_ws', 'select', 'visible'),
  ('transfers', 'a_personal_ws', 'insert', 'ok'),
  ('transfers', 'a_personal_ws', 'update', 'ok'),
  ('transfers', 'a_personal_ws', 'delete', 'ok'),
  ('transfers', 'b_personal_ws', 'select', 'hidden'),
  ('transfers', 'b_personal_ws', 'insert', '42501'),
  ('transfers', 'b_personal_ws', 'update', 'none'),
  ('transfers', 'b_personal_ws', 'delete', 'none');

select is(
  o.result,
  e.result,
  format('%s · %s · %s', o.table_name, o.ws, o.op)
)
from rls_test.observed o
join rls_test.expected e using (table_name, ws, op)
order by o.table_name, o.ws, o.op;

select is(
  (select count(*) from rls_test.observed o
   join rls_test.expected e using (table_name, ws, op)),
  (select count(*) from rls_test.observed),
  'cada resultado observado tiene su valor esperado'
);

select * from finish();

rollback;
