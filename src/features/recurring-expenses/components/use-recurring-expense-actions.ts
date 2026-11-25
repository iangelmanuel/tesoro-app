"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import { deleteRecurringExpense, toggleRecurringExpense } from "../actions"
import type { RecurringExpense } from "../queries"

/**
 * Pausar o reanudar y eliminar un gasto fijo con su toast. Lo comparten el
 * menú ⋮ de la lista y el Sheet del gasto.
 */
export function useRecurringExpenseActions(
  expense: Pick<RecurringExpense, "id" | "is_active">
) {
  const { pending, run: runWithToast } = useActionToast()

  function toggle() {
    runWithToast(
      () => toggleRecurringExpense(expense.id, !expense.is_active),
      expense.is_active ? "Gasto fijo pausado" : "Gasto fijo reanudado"
    )
  }

  function remove(onDeleted?: () => void) {
    runWithToast(
      () => deleteRecurringExpense(expense.id),
      "Gasto fijo eliminado",
      onDeleted
    )
  }

  return { pending, toggle, remove }
}
