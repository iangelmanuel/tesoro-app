"use client"

import { useEffect, useState } from "react"
import { loadRecurringExpenseHistory } from "../actions"
import type { RecurringExpense, RecurringExpenseHistory } from "../queries"
import { HISTORY_PAGE_SIZE } from "../recurring-expense-history"

/**
 * Historial del Sheet de un gasto fijo (SPEC 37): se pide al abrir, con "Ver
 * más", tras un pago (`reload`) y al pausar o editar el gasto.
 */
export function useRecurringExpenseSheet(
  expense: Pick<RecurringExpense, "id" | "is_active" | "updated_at">,
  open: boolean
) {
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE)
  // Sube tras registrar un pago para volver a pedir el historial
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<RecurringExpenseHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  // `is_active` y `updated_at` no se leen: vuelven a pedir el historial al
  // pausar, reanudar o editar
  useEffect(() => {
    if (!open) {
      return
    }
    let active = true
    loadRecurringExpenseHistory(expense.id, limit).then((result) => {
      if (!active) {
        return
      }
      if (result.error !== undefined) {
        setError(result.error)
      } else {
        setError(null)
        setHistory(result.data)
      }
    })
    return () => {
      active = false
    }
  }, [open, expense.id, expense.is_active, expense.updated_at, limit, version])

  return {
    history,
    error,
    reload: () => setVersion((value) => value + 1),
    showMore: () => setLimit((value) => value + HISTORY_PAGE_SIZE)
  }
}
