-- Índices de llaves foráneas (SPEC 56a): las 18 que el advisor de Supabase
-- marcó sin índice que las cubra (unindexed_foreign_keys). Sin índice, borrar
-- o actualizar la fila padre (una cuenta, una deuda, un espacio) recorre la
-- tabla hija completa para verificar o propagar la FK.
--
-- Las FK compuestas (account_id, workspace_id) estaban "cubiertas" por un
-- índice parcial solo de account_id, que no cuenta como cobertura. El nuevo
-- índice compuesto empieza por account_id, así que sirve a las mismas
-- consultas: el simple se reemplaza para no pagar dos índices en cada
-- escritura (tres de ellos el advisor ya los marcaba sin uso).

-- Cuentas: FK (account_id, workspace_id) -> accounts (id, workspace_id)

create index account_adjustments_account_workspace
  on public.account_adjustments (account_id, workspace_id);

drop index public.debt_entries_account;
create index debt_entries_account
  on public.debt_entries (account_id, workspace_id);

drop index public.debts_account_id_idx;
create index debts_account
  on public.debts (account_id, workspace_id);

drop index public.goal_contributions_account;
create index goal_contributions_account
  on public.goal_contributions (account_id, workspace_id);

drop index public.recurring_expenses_account_id_idx;
create index recurring_expenses_account
  on public.recurring_expenses (account_id, workspace_id);

drop index public.transactions_account;
create index transactions_account
  on public.transactions (account_id, workspace_id);

create index transfers_from_account
  on public.transfers (from_account_id, workspace_id);

create index transfers_to_account
  on public.transfers (to_account_id, workspace_id);

-- recurring_incomes.account_id es FK simple a accounts (id)
create index recurring_incomes_account
  on public.recurring_incomes (account_id);

-- Padres dentro del espacio: FK (padre_id, workspace_id)

create index debt_entries_debt_workspace
  on public.debt_entries (debt_id, workspace_id);

create index goal_contributions_goal_workspace
  on public.goal_contributions (goal_id, workspace_id);

create index receivable_installment_history_debt_workspace
  on public.receivable_installment_history (debt_id, workspace_id);

-- Categorías

create index budgets_category
  on public.budgets (category_id);

create index recurring_expenses_category
  on public.recurring_expenses (category_id);

create index recurring_incomes_category
  on public.recurring_incomes (category_id);

-- Espacio: FK workspace_id -> workspaces (id), para borrar un espacio

create index debt_entry_allocations_workspace
  on public.debt_entry_allocations (workspace_id);

create index mcp_operations_workspace
  on public.mcp_operations (workspace_id);

create index recurring_income_allocations_workspace
  on public.recurring_income_allocations (workspace_id);
