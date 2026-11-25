import { parseReportParams } from "@/features/reports/period"

// Periodo elegido en el diálogo de Exportar (SPEC 32). Lógica pura: el
// diálogo la usa para prellenar, cambiar de periodo y armar el rango.

/** Periodos del selector del diálogo */
export const EXPORT_PERIODS = [
  "month",
  "quarter",
  "year",
  "range",
  "all"
] as const

/** Un periodo del selector del diálogo */
export type ExportPeriod = (typeof EXPORT_PERIODS)[number]

/** Etiquetas visibles de cada periodo */
export const EXPORT_PERIOD_LABELS: Record<ExportPeriod, string> = {
  month: "Mes",
  quarter: "Trimestre",
  year: "Año",
  range: "Rango de meses",
  all: "Todo el historial"
}

/** Lo que el usuario eligió en el diálogo */
export interface ExportSelection {
  period: ExportPeriod
  /** YYYY-MM, YYYY-Qn o YYYY según el periodo */
  value: string
  /** YYYY-MM, solo en "range" */
  from: string
  to: string
}

/** Trimestre YYYY-Qn de un mes YYYY-MM */
export const quarterOf = (month: string) =>
  `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`

/** El menor de dos meses YYYY-MM */
export const minMonth = (a: string, b: string) => (a < b ? a : b)

/** El mayor de dos meses YYYY-MM */
export const maxMonth = (a: string, b: string) => (a > b ? a : b)

/** Meses (YYYY-MM) de una selección, cortados en el mes actual */
export function selectionMonths(
  selection: ExportSelection,
  current: string,
  historyStart: string
): { from: string; to: string } {
  switch (selection.period) {
    case "month":
      return { from: selection.value, to: selection.value }
    case "quarter": {
      const [year, quarter] = selection.value.split("-Q").map(Number)
      const first = (quarter - 1) * 3 + 1
      const pad = (n: number) => String(n).padStart(2, "0")
      return {
        from: `${year}-${pad(first)}`,
        to: minMonth(`${year}-${pad(first + 2)}`, current)
      }
    }
    case "year":
      return {
        from: `${selection.value}-01`,
        to: minMonth(`${selection.value}-12`, current)
      }
    case "range":
      return { from: selection.from, to: selection.to }
    case "all":
      return { from: historyStart, to: current }
  }
}

/**
 * Prellenado con el periodo de Reportes: mes, trimestre y año pasan igual;
 * un rango por días pasa a los meses que contienen `from` y `to`
 */
export function initialSelection(
  searchParams: URLSearchParams,
  current: string
): ExportSelection {
  const params = parseReportParams(Object.fromEntries(searchParams))
  const base = { from: current, to: current }

  if (params.period === "range") {
    return {
      period: "range",
      value: current,
      from: minMonth(params.from.slice(0, 7), current),
      to: minMonth(params.to.slice(0, 7), current)
    }
  }
  if (params.period === "month") {
    const value = minMonth(params.value ?? current, current)
    return { period: "month", value, from: value, to: value }
  }
  if (params.period === "quarter") {
    const value = params.value ?? quarterOf(current)
    return {
      period: "quarter",
      value: value > quarterOf(current) ? quarterOf(current) : value,
      ...base
    }
  }
  const value = params.value ?? current.slice(0, 4)
  return {
    period: "year",
    value: value > current.slice(0, 4) ? current.slice(0, 4) : value,
    ...base
  }
}

/** Selección al cambiar de periodo: conserva los meses que ya cubría */
export function changeSelectionPeriod(
  prev: ExportSelection,
  period: ExportPeriod,
  current: string,
  historyStart: string
): ExportSelection {
  const range = selectionMonths(prev, current, historyStart)
  switch (period) {
    case "month":
      return { ...prev, period, value: range.to }
    case "quarter":
      return { ...prev, period, value: quarterOf(range.to) }
    case "year":
      return { ...prev, period, value: range.to.slice(0, 4) }
    case "range":
      return { ...prev, period, from: range.from, to: range.to }
    case "all":
      return { ...prev, period }
  }
}
