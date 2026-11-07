-- Servidor MCP para agentes de IA (SPEC 34).
--
--   mcp_connections:    una fila por agente autorizado (client_id de Supabase
--                       OAuth) con su acceso: solo lectura o lectura y
--                       escritura. Supabase OAuth no tiene scopes propios.
--   mcp_operations:     una fila por escritura real del MCP.
--   mcp_operation_rows: snapshot antes y después de cada fila tocada. before
--                       null = se creó; after null = se borró.
--   mcp_rate_limits:    contador por usuario en ventanas fijas de 1 minuto.
--
-- undo_mcp_operation restaura los snapshots en una transacción. La ventana
-- para revertir es de 30 días; purge-mcp-operations borra lo más viejo.

create type public.mcp_access as enum ('read', 'write');
create type public.mcp_operation_status as enum ('applied', 'undone', 'failed');

create table public.mcp_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  client_name text not null check (char_length(client_name) between 1 and 120),
  access public.mcp_access not null default 'read',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (user_id, client_id)
);

create table public.mcp_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id text not null,
  tool text not null,     -- 'create_transactions', 'update_transfers'…
  summary text not null,  -- '3 movimientos creados en Personal'
  row_count int not null check (row_count between 1 and 400),
  status public.mcp_operation_status not null default 'applied',
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  check ((status = 'undone') = (undone_at is not null))
);

create index mcp_operations_user_created
  on public.mcp_operations (user_id, created_at desc);

create table public.mcp_operation_rows (
  operation_id uuid not null references public.mcp_operations (id) on delete cascade,
  position int not null,
  table_name text not null check (table_name in (
    'transactions', 'transfers', 'categories', 'debt_entries',
    'goal_contributions', 'receivable_installment_history'
  )),
  row_id uuid not null,
  before jsonb,
  after jsonb,
  check (before is not null or after is not null),
  primary key (operation_id, position)
);

create table public.mcp_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_start)
);

-- RLS

alter table public.mcp_connections enable row level security;
alter table public.mcp_operations enable row level security;
alter table public.mcp_operation_rows enable row level security;
-- Sin políticas: solo mcp_hit_rate_limit() la toca
alter table public.mcp_rate_limits enable row level security;

create policy "mcp_connections_select_own"
  on public.mcp_connections for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "mcp_connections_insert_own"
  on public.mcp_connections for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "mcp_connections_update_own"
  on public.mcp_connections for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "mcp_connections_delete_own"
  on public.mcp_connections for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "mcp_operations_select_own"
  on public.mcp_operations for select
  to authenticated
  using (user_id = (select auth.uid()));

-- La operación solo se registra en un espacio propio
create policy "mcp_operations_insert_own"
  on public.mcp_operations for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_workspace_owner(workspace_id)
  );

create policy "mcp_operations_update_own"
  on public.mcp_operations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "mcp_operations_delete_own"
  on public.mcp_operations for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "mcp_operation_rows_select_own"
  on public.mcp_operation_rows for select
  to authenticated
  using (exists (
    select 1 from public.mcp_operations o
    where o.id = operation_id and o.user_id = (select auth.uid())
  ));

create policy "mcp_operation_rows_insert_own"
  on public.mcp_operation_rows for insert
  to authenticated
  with check (exists (
    select 1 from public.mcp_operations o
    where o.id = operation_id and o.user_id = (select auth.uid())
  ));

create policy "mcp_operation_rows_update_own"
  on public.mcp_operation_rows for update
  to authenticated
  using (exists (
    select 1 from public.mcp_operations o
    where o.id = operation_id and o.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.mcp_operations o
    where o.id = operation_id and o.user_id = (select auth.uid())
  ));

create policy "mcp_operation_rows_delete_own"
  on public.mcp_operation_rows for delete
  to authenticated
  using (exists (
    select 1 from public.mcp_operations o
    where o.id = operation_id and o.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.mcp_connections to authenticated;
grant select, insert, update, delete on public.mcp_operations to authenticated;
grant select, insert, update, delete on public.mcp_operation_rows to authenticated;
revoke all on public.mcp_rate_limits from anon, authenticated;

-- Rate limit: 120 llamadas por minuto por usuario, en ventanas fijas. Cuenta
-- la llamada actual y borra las ventanas de más de una hora del usuario.
-- retry_after son los segundos que faltan para la siguiente ventana.
create function public.mcp_hit_rate_limit()
returns table (allowed boolean, retry_after int)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  insert into public.mcp_rate_limits as r (user_id, window_start, count)
  values (v_user, v_window, 1)
  on conflict (user_id, window_start)
    do update set count = r.count + 1
  returning r.count into v_count;

  delete from public.mcp_rate_limits r
  where r.user_id = v_user
    and r.window_start < now() - interval '1 hour';

  allowed := v_count <= 120;
  retry_after := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_window + interval '1 minute' - now())))::int
    )
  end;
  return next;
end;
$$;

revoke execute on function public.mcp_hit_rate_limit() from public, anon;
grant execute on function public.mcp_hit_rate_limit() to authenticated;

-- Columnas que se pueden escribir al restaurar una fila: las del snapshot
-- que existen en la tabla y no son generadas
create function public.mcp_snapshot_columns(p_table text, p_snapshot jsonb)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select string_agg(format('%I', a.attname), ', ' order by a.attnum)
  from pg_catalog.pg_attribute a
  where a.attrelid = format('public.%I', p_table)::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attgenerated = ''
    and p_snapshot ? a.attname;
$$;

-- undo_mcp_operation es security invoker y la llama como el usuario
revoke execute on function public.mcp_snapshot_columns(text, jsonb) from public, anon;
grant execute on function public.mcp_snapshot_columns(text, jsonb) to authenticated;

-- Revierte una operación del MCP. security invoker: la RLS de cada tabla
-- aplica como el usuario. Todo o nada:
--   1. la operación debe ser del usuario, estar 'applied' o 'failed' y tener
--      30 días o menos;
--   2. revisa cada fila contra su snapshot 'after' (updated_at igual, o que
--      no exista si se borró). Una sola fila cambiada aborta sin tocar nada;
--   3. restaura en orden inverso: borra lo creado, recrea lo borrado con su
--      mismo id y devuelve lo editado;
--   4. marca la operación 'undone'.
-- En una 'failed' la compensación pudo dejar filas ya revertidas: las que
-- ya están como en 'before' (o ya no existen si se crearon) se saltan.
create function public.undo_mcp_operation(p_operation_id uuid)
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

  update public.mcp_operations
  set status = 'undone', undone_at = now()
  where id = p_operation_id;
end;
$$;

revoke execute on function public.undo_mcp_operation(uuid) from public, anon;
grant execute on function public.undo_mcp_operation(uuid) to authenticated;

-- Borra las operaciones de más de 30 días (sus filas caen en cascada)
create function public.purge_mcp_operations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.mcp_operations
  where created_at < now() - interval '30 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Solo pg_cron la ejecuta; no se expone como RPC
revoke execute on function public.purge_mcp_operations() from public, anon, authenticated;

-- 08:30 UTC, después de purge-deleted-workspaces
select cron.schedule(
  'purge-mcp-operations',
  '30 8 * * *',
  $$select public.purge_mcp_operations()$$
);
