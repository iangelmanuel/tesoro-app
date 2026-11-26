-- Rendimiento (SPEC 56a): índice de workspaces por dueño y funciones de
-- conjunto para las políticas RLS.
--
-- is_workspace_owner(workspace_id) e is_workspace_writable(workspace_id)
-- reciben la columna de la fila, así que Postgres las evalúa por cada fila
-- leída (una subconsulta a workspaces por fila). Las funciones de conjunto no
-- dependen de la fila: dentro de `workspace_id = any (array(select ...))`
-- se evalúan una vez por consulta (InitPlan). Las políticas se reescriben en
-- la migración siguiente; is_workspace_owner e is_workspace_writable se
-- quedan para las RPC y los triggers.

-- Lo usan la subconsulta de las funciones de conjunto y getPersonalWorkspace
-- (owner_id + type). El índice único parcial de Personal solo cubre type =
-- 'personal'.
create index workspaces_owner_type on public.workspaces (owner_id, type);

-- Espacios del usuario autenticado. security invoker: lee workspaces con su
-- propia política (owner_id = auth.uid())
create function public.owned_workspace_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.workspaces where owner_id = (select auth.uid())
$$;

-- Espacios del usuario que aceptan escrituras: sin marca de borrado
create function public.writable_workspace_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id from public.workspaces
  where owner_id = (select auth.uid()) and deletion_requested_at is null
$$;

revoke execute on function public.owned_workspace_ids() from public, anon;
grant execute on function public.owned_workspace_ids() to authenticated;

revoke execute on function public.writable_workspace_ids() from public, anon;
grant execute on function public.writable_workspace_ids() to authenticated;
