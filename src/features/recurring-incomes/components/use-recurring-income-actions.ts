"use client"

import { useTransition } from "react"
import { toast } from "@heroui/react"
import { deleteRecurringIncome, toggleRecurringIncome } from "../actions"
import type { RecurringIncome } from "../queries"

/**
 * Pausar o reanudar y eliminar un ingreso fijo, con su toast. Lo comparten el
 * menú de la fila y el Sheet (SPEC 38).
 */
export function useRecurringIncomeActions(income: RecurringIncome) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const result = await toggleRecurringIncome(income.id, !income.is_active)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(
          income.is_active ? "Ingreso fijo pausado" : "Ingreso fijo reanudado"
        )
      }
    })
  }

  function remove(onDeleted?: () => void) {
    startTransition(async () => {
      const result = await deleteRecurringIncome(income.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Ingreso fijo eliminado")
        onDeleted?.()
      }
    })
  }

  return { pending, toggle, remove }
}
