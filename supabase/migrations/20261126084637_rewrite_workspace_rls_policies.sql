-- Políticas RLS evaluadas una vez por consulta (SPEC 56a).
--
-- Cada política que llamaba is_workspace_owner(workspace_id) o
-- is_workspace_writable(workspace_id) pasa a
-- `workspace_id = any (array(select public.owned_workspace_ids()))` o
-- `... writable_workspace_ids()`. Mismo acceso: el dueño es el mismo y
-- "writable" sigue siendo "sin marca de borrado".
--
-- `array(select ...)` no depende de la fila: Postgres lo calcula una vez por
-- consulta (InitPlan) y lo usa como condición del índice (Index Cond). La
-- función de antes recibía la columna de la fila y se evaluaba por cada fila,
-- con una subconsulta a workspaces cada vez. `in (select ...)` también lo
-- calcula una vez, pero como hashed SubPlan en el filtro, no en el índice.
--
-- alter policy conserva nombre, comando y roles; solo cambia using / with
-- check. Las políticas que usaban owner para escribir siguen con owner
-- (mismo acceso que hoy; ver docs/rendimiento.md). Lo verifica
-- supabase/tests/rls_workspace_access.test.sql, igual antes y después.

-- account_adjustments

alter policy account_adjustments_delete_own on public.account_adjustments
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy account_adjustments_insert_own on public.account_adjustments
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy account_adjustments_select_own on public.account_adjustments
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy account_adjustments_update_own on public.account_adjustments
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- accounts

alter policy accounts_delete_unused on public.accounts
  using (workspace_id = any (array(select public.writable_workspace_ids()))
    and not exists (
      select 1 from public.account_adjustments a where a.account_id = accounts.id
    )
    and not exists (
      select 1 from public.recurring_incomes r where r.account_id = accounts.id
    ));

alter policy accounts_insert_own on public.accounts
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy accounts_select_own on public.accounts
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy accounts_update_own on public.accounts
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- budgets

alter policy budgets_delete_own on public.budgets
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy budgets_insert_own on public.budgets
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy budgets_select_own on public.budgets
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy budgets_update_own on public.budgets
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- business_profiles

alter policy business_profiles_insert_own on public.business_profiles
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy business_profiles_select_own on public.business_profiles
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy business_profiles_update_own on public.business_profiles
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- categories

alter policy categories_insert_own on public.categories
  with check (workspace_id is not null and workspace_id = any (array(select public.writable_workspace_ids())));

alter policy categories_select_system_or_own on public.categories
  using (workspace_id is null or workspace_id = any (array(select public.owned_workspace_ids())));

alter policy categories_update_own on public.categories
  using (workspace_id is not null and workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id is not null and workspace_id = any (array(select public.writable_workspace_ids())));

-- debt_entries

alter policy debt_entries_delete_own on public.debt_entries
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debt_entries_insert_own on public.debt_entries
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debt_entries_select_own on public.debt_entries
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debt_entries_update_own on public.debt_entries
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- debt_entry_allocations

alter policy debt_entry_allocations_delete_own on public.debt_entry_allocations
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy debt_entry_allocations_insert_own on public.debt_entry_allocations
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy debt_entry_allocations_select_own on public.debt_entry_allocations
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debt_entry_allocations_update_own on public.debt_entry_allocations
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- debts

alter policy debts_delete_unused on public.debts
  using (workspace_id = any (array(select public.writable_workspace_ids()))
    and not exists (
      select 1 from public.debt_entries e where e.debt_id = debts.id
    )
    and not exists (
      select 1 from public.receivable_installment_history h
      where h.debt_id = debts.id
    ));

alter policy debts_insert_own on public.debts
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debts_select_own on public.debts
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy debts_update_own on public.debts
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- dismissed_recommendations

alter policy dismissed_recommendations_delete_own on public.dismissed_recommendations
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy dismissed_recommendations_insert_own on public.dismissed_recommendations
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy dismissed_recommendations_select_own on public.dismissed_recommendations
  using (workspace_id = any (array(select public.owned_workspace_ids())));

-- goal_contributions

alter policy goal_contributions_delete_own on public.goal_contributions
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy goal_contributions_insert_own on public.goal_contributions
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy goal_contributions_select_own on public.goal_contributions
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy goal_contributions_update_own on public.goal_contributions
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- imports

alter policy imports_select_own on public.imports
  using (workspace_id = any (array(select public.owned_workspace_ids())));

-- mcp_operations

alter policy mcp_operations_insert_own on public.mcp_operations
  with check (user_id = (select auth.uid()) and workspace_id = any (array(select public.owned_workspace_ids())));

-- receivable_installment_history

alter policy receivable_installment_history_delete_own on public.receivable_installment_history
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy receivable_installment_history_insert_own on public.receivable_installment_history
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy receivable_installment_history_select_own on public.receivable_installment_history
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy receivable_installment_history_update_own on public.receivable_installment_history
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- recurring_expenses

alter policy recurring_expenses_delete_own on public.recurring_expenses
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy recurring_expenses_insert_own on public.recurring_expenses
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy recurring_expenses_select_own on public.recurring_expenses
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy recurring_expenses_update_own on public.recurring_expenses
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- recurring_income_allocations

alter policy recurring_income_allocations_delete_own on public.recurring_income_allocations
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy recurring_income_allocations_insert_own on public.recurring_income_allocations
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy recurring_income_allocations_select_own on public.recurring_income_allocations
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy recurring_income_allocations_update_own on public.recurring_income_allocations
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- recurring_incomes

alter policy recurring_incomes_delete_own on public.recurring_incomes
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy recurring_incomes_insert_own on public.recurring_incomes
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy recurring_incomes_select_own on public.recurring_incomes
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy recurring_incomes_update_own on public.recurring_incomes
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- savings_goals

alter policy savings_goals_delete_unused on public.savings_goals
  using (workspace_id = any (array(select public.writable_workspace_ids()))
    and not exists (
      select 1 from public.goal_contributions c where c.goal_id = savings_goals.id
    ));

alter policy savings_goals_insert_own on public.savings_goals
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy savings_goals_select_own on public.savings_goals
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy savings_goals_update_own on public.savings_goals
  using (workspace_id = any (array(select public.owned_workspace_ids())))
  with check (workspace_id = any (array(select public.owned_workspace_ids())));

-- transactions

alter policy transactions_delete_own on public.transactions
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy transactions_insert_own on public.transactions
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy transactions_select_own on public.transactions
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy transactions_update_own on public.transactions
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

-- transfers

alter policy transfers_delete_own on public.transfers
  using (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy transfers_insert_own on public.transfers
  with check (workspace_id = any (array(select public.writable_workspace_ids())));

alter policy transfers_select_own on public.transfers
  using (workspace_id = any (array(select public.owned_workspace_ids())));

alter policy transfers_update_own on public.transfers
  using (workspace_id = any (array(select public.writable_workspace_ids())))
  with check (workspace_id = any (array(select public.writable_workspace_ids())));
