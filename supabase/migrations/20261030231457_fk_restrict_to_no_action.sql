-- Las FK on delete restrict se revisan al instante y rompen la cascada al
-- borrar un usuario (SPEC 09): auth.users → profiles → workspaces → tablas del
-- espacio. Con no action la revisión se hace al final de la sentencia, cuando
-- las filas que referencian ya se borraron. Fuera de la cascada bloquean igual
-- que antes: borrar una categoría o cuenta en uso sigue fallando con 23503.

-- Categorías (SPEC 02 y 04)
alter table public.transactions
  drop constraint transactions_category_id_fkey,
  add constraint transactions_category_id_fkey
    foreign key (category_id)
    references public.categories (id) on delete no action;

alter table public.recurring_expenses
  drop constraint recurring_expenses_category_id_fkey,
  add constraint recurring_expenses_category_id_fkey
    foreign key (category_id)
    references public.categories (id) on delete no action;

alter table public.budgets
  drop constraint budgets_category_id_fkey,
  add constraint budgets_category_id_fkey
    foreign key (category_id)
    references public.categories (id) on delete no action;

-- Cuentas (SPEC 08c)
alter table public.transactions
  drop constraint transactions_account_id_workspace_id_fkey,
  add constraint transactions_account_id_workspace_id_fkey
    foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete no action;

alter table public.transfers
  drop constraint transfers_from_account_id_workspace_id_fkey,
  add constraint transfers_from_account_id_workspace_id_fkey
    foreign key (from_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete no action,
  drop constraint transfers_to_account_id_workspace_id_fkey,
  add constraint transfers_to_account_id_workspace_id_fkey
    foreign key (to_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete no action;
