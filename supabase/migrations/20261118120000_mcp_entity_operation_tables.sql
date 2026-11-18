-- SPEC 44: el log del MCP cubre crear y editar cuentas, deudas y Me deben,
-- gastos fijos, ingresos fijos, metas y presupuestos.
--
--   accounts, debts, recurring_expenses, recurring_incomes, savings_goals,
--   budgets: snapshot antes y después de la entidad.
--
-- Revertir un create borra la entidad, pero solo si nada la referencia:
-- movimientos, traspasos, abonos, aportes, ajustes, gastos fijos que la usan
-- como cuenta habitual… Borrar en cascada desde un undo es peligroso, así
-- que si hay referencias la RPC falla con el motivo y no toca nada. La
-- operación sigue 'applied': se puede reintentar cuando el usuario quite lo
-- que la referencia.

-- accounts, debts y savings_goals no tenían política de delete: la UI las
-- archiva o las cierra. Undo necesita borrar una recién creada, así que se
-- permite borrar solo las que no tienen datos que se irían en cascada
-- (ajustes, abonos, cambios de cuota, aportes). Las demás referencias son
-- 'no action' y Postgres ya las protege.
create policy "accounts_delete_unused"
  on public.accounts for delete
  to authenticated
  using (
    public.is_workspace_writable(workspace_id)
    and not exists (
      select 1 from public.account_adjustments a where a.account_id = accounts.id
    )
    and not exists (
      select 1 from public.recurring_incomes r where r.account_id = accounts.id
    )
  );

create policy "debts_delete_unused"
  on public.debts for delete
  to authenticated
  using (
    public.is_workspace_writable(workspace_id)
    and not exists (
      select 1 from public.debt_entries e where e.debt_id = debts.id
    )
    and not exists (
      select 1 from public.receivable_installment_history h
      where h.debt_id = debts.id
    )
  );

create policy "savings_goals_delete_unused"
  on public.savings_goals for delete
  to authenticated
  using (
    public.is_workspace_writable(workspace_id)
    and not exists (
      select 1 from public.goal_contributions c where c.goal_id = savings_goals.id
    )
  );

alter table public.mcp_operation_rows
  drop constraint mcp_operation_rows_table_name_check;

alter table public.mcp_operation_rows
  add constraint mcp_operation_rows_table_name_check check (table_name in (
    'transactions', 'transfers', 'categories', 'debt_entries',
    'goal_contributions', 'receivable_installment_history', 'debts',
    'debt_entry_allocations', 'recurring_income_allocations', 'accounts',
    'recurring_expenses', 'recurring_incomes', 'savings_goals', 'budgets'
  ));

-- Filas que referencian public.<p_table>(id = p_id) por llave foránea, por
-- tabla hija. p_exclude son los ids que la misma operación crea y que se
-- borran antes (orden inverso del log). security invoker: cuenta lo que el
-- usuario ve por RLS, que en sus espacios es todo.
create function public.mcp_row_references(
  p_table text,
  p_id uuid,
  p_exclude uuid[] default '{}'
)
returns table (child_table text, total bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_fk record;
  v_total bigint;
begin
  for v_fk in
    select
      child.relname as child_table,
      child_col.attname as child_column
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class child on child.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = child.relnamespace
    -- La columna hija que apunta a la columna 'id' del padre
    cross join lateral unnest(c.conkey, c.confkey) as k (child_attnum, parent_attnum)
    join pg_catalog.pg_attribute parent_col
      on parent_col.attrelid = c.confrelid and parent_col.attnum = k.parent_attnum
    join pg_catalog.pg_attribute child_col
      on child_col.attrelid = c.conrelid and child_col.attnum = k.child_attnum
    where c.contype = 'f'
      and c.confrelid = format('public.%I', p_table)::regclass
      and n.nspname = 'public'
      and parent_col.attname = 'id'
      -- El log del MCP no es un dato del usuario
      and child.relname not in ('mcp_operation_rows')
  loop
    execute format(
      'select count(*) from public.%I t where t.%I = $1 and not (t.id = any ($2))',
      v_fk.child_table, v_fk.child_column
    ) into v_total using p_id, p_exclude;

    if v_total > 0 then
      child_table := v_fk.child_table;
      total := v_total;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.mcp_row_references(text, uuid, uuid[]) from public, anon;
grant execute on function public.mcp_row_references(text, uuid, uuid[]) to authenticated;

-- Nombre de una entidad y de sus referencias para el mensaje de error
create function public.mcp_entity_label(p_table text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_table
    when 'accounts' then 'la cuenta'
    when 'debts' then 'la deuda'
    when 'recurring_expenses' then 'el gasto fijo'
    when 'recurring_incomes' then 'el ingreso fijo'
    when 'savings_goals' then 'la meta'
    when 'budgets' then 'el presupuesto'
    when 'transactions' then 'movimientos'
    when 'transfers' then 'traspasos'
    when 'debt_entries' then 'abonos o cargos'
    when 'goal_contributions' then 'aportes'
    when 'account_adjustments' then 'ajustes de saldo'
    when 'receivable_installment_history' then 'cambios de cuota'
    when 'recurring_income_allocations' then 'ingresos recibidos'
    when 'debt_entry_allocations' then 'cobros repartidos'
    else p_table
  end;
$$;

revoke execute on function public.mcp_entity_label(text) from public, anon;
grant execute on function public.mcp_entity_label(text) to authenticated;

-- Mismo flujo de SPEC 43 (ver 20261117160000_mcp_more_operation_tables.sql)
-- más: antes de revisar conflictos, un create de una entidad que ya tiene
-- filas que la referencian aborta con el motivo, sin tocar nada.
create or replace function public.undo_mcp_operation(p_operation_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation public.mcp_operations%rowtype;
  v_row public.mcp_operation_rows%rowtype;
  v_current jsonb;
  v_conflicts int := 0;
  v_skip uuid[] := '{}';
  v_columns text;
  v_parent uuid;
  v_created uuid[];
  v_references text;
  v_deleted int;
begin
  select * into v_operation
  from public.mcp_operations
  where id = p_operation_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'No se encontró la operación' using errcode = 'P0002';
  end if;
  if v_operation.status = 'undone' then
    raise exception 'Esta operación ya se revirtió' using errcode = 'check_violation';
  end if;
  if v_operation.created_at < now() - interval '30 days' then
    raise exception 'Pasaron más de 30 días: ya no se puede revertir'
      using errcode = 'check_violation';
  end if;

  -- Entidades creadas que ya tienen datos (SPEC 44). Las filas que crea la
  -- misma operación no cuentan: se borran antes.
  select coalesce(array_agg(r.row_id), '{}') into v_created
  from public.mcp_operation_rows r
  where r.operation_id = p_operation_id and r.before is null;

  for v_row in
    select * from public.mcp_operation_rows
    where operation_id = p_operation_id
      and before is null
      and table_name in (
        'accounts', 'debts', 'recurring_expenses', 'recurring_incomes',
        'savings_goals', 'budgets'
      )
    order by position desc
  loop
    select string_agg(
      format('%s %s', ref.total, public.mcp_entity_label(ref.child_table)),
      ', ' order by ref.child_table
    )
    into v_references
    from public.mcp_row_references(v_row.table_name, v_row.row_id, v_created) ref;

    if v_references is not null then
      raise exception 'No se puede revertir: % ya tiene datos vinculados (%). Quítalos primero en Tesoro.',
        public.mcp_entity_label(v_row.table_name), v_references
        using errcode = 'check_violation';
    end if;
  end loop;

  -- Conflictos
  for v_row in
    select * from public.mcp_operation_rows
    where operation_id = p_operation_id
      and table_name not in ('debt_entry_allocations', 'recurring_income_allocations')
    order by position desc
  loop
    execute format('select to_jsonb(t) from public.%I t where t.id = $1', v_row.table_name)
      into v_current
      using v_row.row_id;

    -- Ya revertida por la compensación de una operación fallida
    if v_operation.status = 'failed' and (
      (v_row.before is null and v_current is null)
      or (
        v_row.before is not null and v_current is not null
        and (v_current - 'updated_at') = (v_row.before - 'updated_at')
      )
    ) then
      v_skip := v_skip || v_row.row_id;
      continue;
    end if;

    if v_row.after is null then
      -- Se borró: no debe haber vuelto a existir
      if v_current is not null then
        v_conflicts := v_conflicts + 1;
      end if;
    elsif v_current is null
      or (v_current ->> 'updated_at')::timestamptz
         is distinct from (v_row.after ->> 'updated_at')::timestamptz then
      -- Se creó o editó: debe seguir como quedó
      v_conflicts := v_conflicts + 1;
    end if;
  end loop;

  if v_conflicts > 0 then
    raise exception 'No se puede revertir: % filas cambiaron después. Revisa los movimientos en Tesoro.', v_conflicts
      using errcode = 'check_violation';
  end if;

  -- Restauración
  for v_row in
    select * from public.mcp_operation_rows
    where operation_id = p_operation_id
      and table_name not in ('debt_entry_allocations', 'recurring_income_allocations')
    order by position desc
  loop
    if v_row.row_id = any (v_skip) then
      continue;
    end if;

    if v_row.before is null then
      -- Puede no existir si un trigger o un cascade ya la borró
      execute format('delete from public.%I where id = $1', v_row.table_name)
        using v_row.row_id;
      get diagnostics v_deleted = row_count;

      -- Una entidad sí existía (se revisó arriba): si RLS no la dejó borrar,
      -- no se marca la operación como revertida
      if v_deleted = 0 and v_row.table_name in (
        'accounts', 'debts', 'recurring_expenses', 'recurring_incomes',
        'savings_goals', 'budgets'
      ) then
        raise exception 'No se puede revertir: no se pudo borrar %.',
          public.mcp_entity_label(v_row.table_name)
          using errcode = 'check_violation';
      end if;
    elsif v_row.after is null then
      v_columns := public.mcp_snapshot_columns(v_row.table_name, v_row.before);
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1)',
        v_row.table_name, v_columns
      ) using v_row.before;
    else
      v_columns := public.mcp_snapshot_columns(
        v_row.table_name, v_row.before - 'id'
      );
      execute format(
        'update public.%1$I set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where id = $2',
        v_row.table_name, v_columns
      ) using v_row.before, v_row.row_id;
    end if;
  end loop;

  -- Asignaciones de cobros mensuales, por abono
  for v_parent in
    select distinct (coalesce(r.before, r.after) ->> 'entry_id')::uuid
    from public.mcp_operation_rows r
    where r.operation_id = p_operation_id
      and r.table_name = 'debt_entry_allocations'
  loop
    if exists (select 1 from public.debt_entries e where e.id = v_parent) then
      delete from public.debt_entry_allocations a where a.entry_id = v_parent;

      insert into public.debt_entry_allocations (
        id, workspace_id, entry_id, period_on, amount, created_at
      )
      select a.id, a.workspace_id, a.entry_id, a.period_on, a.amount, a.created_at
      from public.mcp_operation_rows r
      cross join lateral jsonb_populate_record(
        null::public.debt_entry_allocations, r.before
      ) a
      where r.operation_id = p_operation_id
        and r.table_name = 'debt_entry_allocations'
        and r.before is not null
        and a.entry_id = v_parent
      order by r.position;
    end if;
  end loop;

  -- Asignaciones de ingresos fijos, por movimiento
  for v_parent in
    select distinct (coalesce(r.before, r.after) ->> 'transaction_id')::uuid
    from public.mcp_operation_rows r
    where r.operation_id = p_operation_id
      and r.table_name = 'recurring_income_allocations'
  loop
    if exists (select 1 from public.transactions t where t.id = v_parent) then
      delete from public.recurring_income_allocations a
      where a.transaction_id = v_parent;

      insert into public.recurring_income_allocations (
        id, workspace_id, transaction_id, recurring_income_id, due_on, amount,
        created_at
      )
      select a.id, a.workspace_id, a.transaction_id, a.recurring_income_id,
             a.due_on, a.amount, a.created_at
      from public.mcp_operation_rows r
      cross join lateral jsonb_populate_record(
        null::public.recurring_income_allocations, r.before
      ) a
      where r.operation_id = p_operation_id
        and r.table_name = 'recurring_income_allocations'
        and r.before is not null
        and a.transaction_id = v_parent
      order by r.position;
    end if;
  end loop;

  update public.mcp_operations
  set status = 'undone', undone_at = now()
  where id = p_operation_id;
end;
$$;
