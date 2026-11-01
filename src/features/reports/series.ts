import type { LegendItem } from "@/components/charts/chart-card"
import { REPORT_LABELS, type ReportLabels } from "./labels"

// Fuera de income-expense-chart.tsx ("use client"): las páginas de servidor
// la llaman para armar la leyenda de ChartCard

type SeriesLabels = Pick<ReportLabels, "income" | "expense">

/** Series de ingresos vs. gastos para la leyenda, en el orden fijo */
export function incomeExpenseLegend(
  labels: SeriesLabels = REPORT_LABELS.personal,
  showBalance = false
): LegendItem[] {
  return [
    { label: labels.income, color: "var(--income)" },
    { label: labels.expense, color: "var(--expense)" },
    ...(showBalance ? [{ label: "Balance", color: "var(--balance)" }] : [])
  ]
}
