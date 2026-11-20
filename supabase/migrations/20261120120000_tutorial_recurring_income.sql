-- Tour de Ingresos fijos (SPEC 52b): amplía el check de tutorial_progress
-- con la sección 'recurring_income'. El nombre de la restricción se confirmó
-- en la base (tutorial_progress_section_check).

alter table public.tutorial_progress
  drop constraint tutorial_progress_section_check;

alter table public.tutorial_progress
  add constraint tutorial_progress_section_check check (section in (
    'summary', 'transactions', 'accounts', 'recurring', 'recurring_income',
    'budgets', 'goals', 'debts', 'reports', 'recommendations'
  ));
