"use client"

import { useEffect, useState } from "react"
import { loadRecurringIncomeHistory } from "../actions"
import {
  type RecurringIncomeHistory,
  incomeHistoryPageSize
} from "../income-history"
import type { RecurringIncome } from "../queries"

/**
 * Historial del Sheet de un ingreso fijo (SPEC 38): se pide al abrir, con
 * "Ver más" (una página: 12, o 31 en la diaria), tras un cobro (`reload`) y
 * al editar. "Sin fecha fija" no tiene historial.
 */
export function useRecurringIncomeSheet(
  income: Pick<RecurringIncome, "id" | "frequency" | "updated_at">,
  open: boolean
) {
  const pageSize = incomeHistoryPageSize(income.frequency)
  const hasSchedule = income.frequency !== "none"
  const [limit, setLimit] = useState(pageSize)
  // Sube tras registrar un cobro para volver a pedir el historial
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<RecurringIncomeHistory | null>(null)
  const [error, setError] = useState<string | null>(null)

  // `updated_at` no se lee: vuelve a pedir el historial al editar
  useEffect(() => {
    if (!open || !hasSchedule) {
      return
    }
    let active = true
    loadRecurringIncomeHistory(income.id, limit).then((result) => {
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
  }, [open, hasSchedule, income.id, income.updated_at, limit, version])

  return {
    hasSchedule,
    history,
    error,
    reload: () => setVersion((value) => value + 1),
    showMore: () => setLimit((value) => value + pageSize)
  }
}
