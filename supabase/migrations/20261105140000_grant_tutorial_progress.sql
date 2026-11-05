-- Permisos de tutorial_progress (SPEC 27). Las tablas nuevas ya no reciben
-- privilegios por defecto para `authenticated`: sin este grant, las
-- políticas RLS nunca llegan a evaluarse y la consulta falla con
-- "permission denied". Las políticas siguen limitando cada fila a su dueño.

grant select, insert, update, delete on public.tutorial_progress
  to authenticated;
