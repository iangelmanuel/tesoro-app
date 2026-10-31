import type { WorkspaceType } from "@/features/workspaces/queries"

export interface ReportLabels {
  /** Serie de ingresos en gráficas, toggle y títulos */
  income: string
  /** Serie de gastos en gráficas, toggle y títulos */
  expense: string
  /** Sustantivo de un ingreso, p. ej. "Top 5 categorías de ingreso" */
  incomeNoun: string
  /** Sustantivo de un gasto, p. ej. "Top 5 categorías de gasto" */
  expenseNoun: string
  /** Las dos series juntas, para descripciones de gráficas */
  series: string
  /** Descripción de la tendencia mensual */
  trend: string
}

// Personal habla de ingresos y gastos; Empresa, de ventas y costos y gastos.
// Los datos son los mismos: income y expense de transactions.
export const REPORT_LABELS = {
  personal: {
    income: "Ingresos",
    expense: "Gastos",
    incomeNoun: "ingreso",
    expenseNoun: "gasto",
    series: "Ingresos y gastos",
    trend: "ingresos, gastos y balance por mes"
  },
  business: {
    income: "Ventas",
    expense: "Costos y gastos",
    incomeNoun: "venta",
    expenseNoun: "costo",
    series: "Ventas y costos",
    trend: "ventas, costos y gastos, y balance por mes"
  }
} as const satisfies Record<WorkspaceType, ReportLabels>
