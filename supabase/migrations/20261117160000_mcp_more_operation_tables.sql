-- SPEC 43: el log del MCP cubre los pagos de deuda, los cobros de Me deben,
-- los ingresos fijos y los aportes a metas.
--
--   debts:                        el estado 'paid' al saldar un cobro.
--   debt_entry_allocations:       reparto de un cobro mensual (SPEC 39).
--   recurring_income_allocations: reparto de un ingreso fijo (SPEC 38).
--
-- Las asignaciones son datos derivados: los triggers las rehacen al crear un
-- abono o un ingreso enlazado y al cambiar su monto. Por eso undo no las
-- restaura fila por fila: al final, por cada abono o movimiento con
-- asignaciones en el log, borra las actuales e inserta las que había antes
-- (las filas con 'before'). Si el abono o el movimiento ya no existe (se
-- revirtió su creación), no hace nada: el cascade ya las borró.

alter table public.mcp_operation_rows
  drop constraint mcp_operation_rows_table_name_check;

alter table public.mcp_operation_rows
  add constraint mcp_operation_rows_table_name_check check (table_name in (
    'transactions', 'transfers', 'categories', 'debt_entries',
    'goal_contributions', 'receivable_installment_history', 'debts',
    'debt_entry_allocations', 'recurring_income_allocations'
  ));

-- Mismo flujo de SPEC 34 (ver 20261107120000_create_mcp.sql) más:
--   - las asignaciones no cuentan como conflicto: su abono o su movimiento
--     ya se revisa;
--   - se restauran al final, por padre, en el orden del log.
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
