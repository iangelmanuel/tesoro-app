import type { IncomeOccurrenceStatus } from "./occurrences"
import type { UpcomingIncome } from "./queries"
import type { IncomeFrequency } from "./schemas"

// Filas de la lista del mes de Ingresos fijos (SPEC 38). Diaria y cada N
// días tienen muchas ocurrencias por mes: se resumen en una fila por fuente
// que abre su Sheet. Las demás frecuencias van una fila por ocurrencia.

const SUMMARY_FREQUENCIES: readonly IncomeFrequency[] = [
  "daily",
  "every_n_days"
]

export interface IncomeSummaryRow {
  kind: "summary"
  recurringIncomeId: string
  /** Primera ocurrencia de la fuente en la lista: nombre, categoría, cuenta */
  first: UpcomingIncome
  /** Ocurrencias del mes elegido */
  monthCount: number
  /** De esas, las recibidas completas */
  receivedCount: number
  /** No recibidas completas de meses anteriores (solo en el mes actual) */
  carriedCount: number
  /** Recibido y esperado de las ocurrencias del mes elegido */
  received: number
  expected: number
  /** Lo que falta de todas las ocurrencias de la fila */
  remaining: number
  status: IncomeOccurrenceStatus
  /**
   * Ocurrencia hasta la que **Recibir** prellena lo que falta: la última
   * abierta que ya venció (o es de hoy); si todas son futuras, la primera
   * abierta. null si no falta nada.
   */
  receiveDueOn: string | null
}

export interface IncomeOccurrenceRow {
  kind: "occurrence"
  income: UpcomingIncome
}

export type IncomeMonthRow = IncomeSummaryRow | IncomeOccurrenceRow

const toCents = (value: number) => Math.round(value * 100)

// Estado de la fila resumen: lo más urgente de sus ocurrencias
function summaryStatus(incomes: UpcomingIncome[]): IncomeOccurrenceStatus {
  const open = incomes.filter((income) => income.status !== "received")
  if (open.length === 0) return "received"
  for (const status of ["overdue", "partial", "today"] as const) {
    if (open.some((income) => income.status === status)) return status
  }
  return "pending"
}

function toSummary(
  incomes: UpcomingIncome[],
  month: string,
  today: string
): IncomeSummaryRow {
  const inMonth = incomes.filter((income) => income.dueOn.startsWith(month))
  const open = incomes.filter((income) => income.remaining > 0)
  const due = open.filter((income) => income.dueOn <= today)
  const sum = (rows: UpcomingIncome[], pick: (row: UpcomingIncome) => number) =>
    rows.reduce((total, row) => total + toCents(pick(row)), 0) / 100

  return {
    kind: "summary",
    recurringIncomeId: incomes[0].recurringIncomeId,
    first: incomes[0],
    monthCount: inMonth.length,
    receivedCount: inMonth.filter((income) => income.status === "received")
      .length,
    carriedCount: incomes.length - inMonth.length,
    received: sum(inMonth, (row) => Math.min(row.receivedAmount, row.amount)),
    expected: sum(inMonth, (row) => row.amount),
    remaining: sum(open, (row) => row.remaining),
    status: summaryStatus(incomes),
    receiveDueOn: (due.at(-1) ?? open[0])?.dueOn ?? null
  }
}

/**
 * Agrupa las ocurrencias (ya en orden de vencimiento) en filas. Cada fila
 * resumen ocupa el lugar de la primera ocurrencia de su fuente.
 */
export function groupIncomeRows(
  incomes: UpcomingIncome[],
  month: string,
  today: string
): IncomeMonthRow[] {
  const bySource = new Map<string, UpcomingIncome[]>()
  for (const income of incomes) {
    if (SUMMARY_FREQUENCIES.includes(income.frequency)) {
      const list = bySource.get(income.recurringIncomeId) ?? []
      list.push(income)
      bySource.set(income.recurringIncomeId, list)
    }
  }

  const rows: IncomeMonthRow[] = []
  const placed = new Set<string>()
  for (const income of incomes) {
    const group = bySource.get(income.recurringIncomeId)
    if (!group) {
      rows.push({ kind: "occurrence", income })
    } else if (!placed.has(income.recurringIncomeId)) {
      placed.add(income.recurringIncomeId)
      rows.push(toSummary(group, month, today))
    }
  }
  return rows
}
