import { monthRange, shiftMonth } from "@/libs/dates"
import { getCategoryTotals, getMonthlyTotals } from "./queries"

// Totales de un periodo y del periodo anterior equivalente, para el badge de
// variación de las KPI (StatCard). Solo reusa las RPC existentes: sin
// esquema nuevo. Corre en el servidor.

export interface PeriodTotals {
  income: number
  expense: number
  balance: number
  txCount: number
}

export interface PeriodComparison {
  current: PeriodTotals
  /** null si no hay periodo anterior con movimientos */
  previous: PeriodTotals | null
}

const EMPTY: PeriodTotals = { income: 0, expense: 0, balance: 0, txCount: 0 }

function sum(rows: PeriodTotals[]): PeriodTotals {
  return rows.reduce(
    (total, row) => ({
      income: total.income + row.income,
      expense: total.expense + row.expense,
      balance: total.balance + row.balance,
      txCount: total.txCount + row.txCount
    }),
    EMPTY
  )
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Cantidad de meses completos que cubre el rango, o null si no es exacto */
function wholeMonths(from: string, to: string) {
  if (!from.endsWith("-01")) return null
  if (monthRange(to.slice(0, 7)).to !== to) return null

  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

// monthly_totals agrupa por mes completo; category_totals filtra por día
// exacto. Un rango que no cae en meses completos se suma desde categorías
async function rangeTotals(
  workspaceId: string,
  from: string,
  to: string
): Promise<PeriodTotals> {
  const [income, expense] = await Promise.all([
    getCategoryTotals(workspaceId, from, to, "income"),
    getCategoryTotals(workspaceId, from, to, "expense")
  ])
  const incomeTotal = income.reduce((total, row) => total + row.total, 0)
  const expenseTotal = expense.reduce((total, row) => total + row.total, 0)

  return {
    income: incomeTotal,
    expense: expenseTotal,
    balance: incomeTotal - expenseTotal,
    txCount: [...income, ...expense].reduce(
      (total, row) => total + row.txCount,
      0
    )
  }
}

/**
 * Totales del periodo [from, to] y del anterior de la misma duración: los
 * N meses previos si el periodo son N meses completos, o los mismos días
 * justo antes si es un rango libre. Con meses completos es una sola llamada.
 */
export async function getPeriodComparison(
  workspaceId: string,
  from: string,
  to: string
): Promise<PeriodComparison> {
  const months = wholeMonths(from, to)

  if (months !== null) {
    const previousFrom = `${shiftMonth(from.slice(0, 7), -months)}-01`
    const rows = await getMonthlyTotals(workspaceId, previousFrom, to)
    const current = sum(rows.filter((row) => row.month >= from))
    const previous = sum(rows.filter((row) => row.month < from))

    return { current, previous: previous.txCount > 0 ? previous : null }
  }

  const days = daysBetween(from, to)
  const previousTo = addDays(from, -1)
  const [current, previous] = await Promise.all([
    rangeTotals(workspaceId, from, to),
    rangeTotals(workspaceId, addDays(previousTo, -(days - 1)), previousTo)
  ])

  return { current, previous: previous.txCount > 0 ? previous : null }
}
