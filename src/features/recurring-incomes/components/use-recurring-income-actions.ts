"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import { deleteRecurringIncome, toggleRecurringIncome } from "../actions"
import type { RecurringIncome } from "../queries"

/**
 * Pausar o reanudar y eliminar un ingreso fijo, con su toast. Lo comparten el
 * menú de la fila y el Sheet (SPEC 38).
 */
export function useRecurringIncomeActions(income: RecurringIncome) {
  const { pending, run: runWithToast } = useActionToast()

  function toggle() {
    runWithToast(
      () => toggleRecurringIncome(income.id, !income.is_active),
      income.is_active ? "Ingreso fijo pausado" : "Ingreso fijo reanudado"
    )
  }

  function remove(onDeleted?: () => void) {
    runWithToast(
      () => deleteRecurringIncome(income.id),
      "Ingreso fijo eliminado",
      onDeleted
    )
  }

  return { pending, toggle, remove }
}
