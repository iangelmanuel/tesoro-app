"use client"

import { useTransition } from "react"
import { toast } from "@heroui/react"
import { deleteRecurringExpense, toggleRecurringExpense } from "../actions"
import type { RecurringExpense } from "../queries"

/**
 * Pausar o reanudar y eliminar un gasto fijo con su toast. Lo comparten el
 * menú ⋮ de la lista y el Sheet del gasto.
 */
export function useRecurringExpenseActions(
  expense: Pick<RecurringExpense, "id" | "is_active">
) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await toggleRecurringExpense(
        expense.id,
        !expense.is_active
      )
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(
          expense.is_active ? "Gasto fijo pausado" : "Gasto fijo reanudado"
        )
      }
    })
  }

  function remove(onDeleted?: () => void) {
    startTransition(async () => {
      const result = await deleteRecurringExpense(expense.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Gasto fijo eliminado")
        onDeleted?.()
      }
    })
  }

  return { pending, toggle, remove }
}
