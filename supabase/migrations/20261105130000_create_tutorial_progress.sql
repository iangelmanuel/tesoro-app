-- Progreso de los tutoriales guiados (SPEC 27). Una fila por sección
-- completada: la ausencia de fila significa "pendiente". Reiniciar es un
-- delete. Al agregar tutoriales de Empresa se amplía el check con una
-- migración nueva.

create table public.tutorial_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  section text not null check (section in (
    'summary', 'transactions', 'accounts', 'recurring', 'budgets',
    'goals', 'debts', 'reports', 'recommendations'
  )),
  completed_at timestamptz not null default now(),
  primary key (user_id, section)
);

comment on table public.tutorial_progress is
  'Tutoriales guiados completados por usuario y sección (SPEC 27)';

alter table public.tutorial_progress enable row level security;

create policy "tutorial_progress_select_own" on public.tutorial_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tutorial_progress_insert_own" on public.tutorial_progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tutorial_progress_update_own" on public.tutorial_progress
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "tutorial_progress_delete_own" on public.tutorial_progress
  for delete to authenticated using (user_id = (select auth.uid()));
