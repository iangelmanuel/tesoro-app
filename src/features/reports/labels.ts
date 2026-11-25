import type { WorkspaceType } from "@/features/workspaces/types"

/** Textos de las series de Reportes, por tipo de espacio */
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
  /** KPI de (ingresos − gastos) / ingresos */
  rate: string
}

// Personal y Empresa hablan de entradas y salidas (SPEC 47).
// Los datos son los mismos: income y expense de transactions.
/** Textos de Reportes de Personal y de Empresa */
export const REPORT_LABELS = {
  personal: {
    income: "Entradas",
    expense: "Salidas",
    incomeNoun: "entrada",
    expenseNoun: "salida",
    series: "Entradas y salidas",
    trend: "entradas, salidas y balance por mes",
    rate: "Tasa de ahorro"
  },
  business: {
    income: "Entradas",
    expense: "Salidas",
    incomeNoun: "entrada",
    expenseNoun: "salida",
    series: "Entradas y salidas",
    trend: "entradas, salidas y balance por mes",
    rate: "Margen"
  }
} as const satisfies Record<WorkspaceType, ReportLabels>
