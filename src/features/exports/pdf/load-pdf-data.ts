import { SITE } from "@/config/site"
import { type ReportQuery, buildReportQuery } from "@/features/reports/period"
import { getMonthlyTotals } from "@/features/reports/queries"
import { workspaceReportsPath } from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import { monthRange } from "@/libs/dates"
import { loadExportData } from "../queries"
import { previousRange } from "../range"
import type { ExportRange } from "../types"
import type { PdfReportData } from "./types"

const minMonth = (a: string, b: string) => (a < b ? a : b)

/**
 * Periodo de Reportes equivalente al del PDF: un mes, un trimestre o un año
 * completos (o cortados en el mes actual, como los arma el diálogo) pasan
 * como tales; cualquier otro, como rango de días
 */
export function reportQueryFor(
  range: Pick<ExportRange, "from" | "to">,
  today: string
): ReportQuery {
  const type = "expense"
  const current = today.slice(0, 7)
  const { from, to } = range

  if (from === to) return { period: "month", value: from, type }

  const year = from.slice(0, 4)
  if (from === `${year}-01` && to === minMonth(`${year}-12`, current)) {
    return { period: "year", value: year, type }
  }

  const quarter = Math.ceil(Number(from.slice(5, 7)) / 3)
  const quarterStart = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}`
  const quarterEnd = `${year}-${String(quarter * 3).padStart(2, "0")}`
  if (from === quarterStart && to === minMonth(quarterEnd, current)) {
    return { period: "quarter", value: `${year}-Q${quarter}`, type }
  }

  return {
    period: "range",
    from: monthRange(from).from,
    to: monthRange(to).to,
    type
  }
}

/** URL absoluta de Reportes del espacio con el mismo periodo (destino del QR) */
export function reportsUrlFor(
  workspace: Pick<Workspace, "id" | "type">,
  range: Pick<ExportRange, "from" | "to">,
  today: string
) {
  const path = workspaceReportsPath(workspace)
  const query = buildReportQuery(reportQueryFor(range, today))
  return `${SITE.site.url}${path}?${query}`
}

/**
 * Ingresos y gastos (ventas y costos en Empresa) del periodo anterior, con
 * la misma RPC que la comparación de Reportes. Los traspasos no cuentan
 */
async function loadPreviousTotals(workspace: Workspace, range: ExportRange) {
  const previous = previousRange(range)
  const rows = await getMonthlyTotals(
    workspace.id,
    `${previous.from}-01`,
    monthRange(previous.to).to
  )

  return {
    income: rows.reduce((total, row) => total + row.income, 0),
    expense: rows.reduce((total, row) => total + row.expense, 0)
  }
}

// Datos del PDF (SPEC 33), con la sesión del usuario y RLS. Parte de
// `loadExportData` (SPEC 32) para que los totales cuadren con el Excel.
// Provisional: las categorías y el score llegan en los pasos 11 y 12.
export async function loadPdfData(
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<PdfReportData> {
  const [data, previousTotals] = await Promise.all([
    loadExportData(workspace, range, today),
    loadPreviousTotals(workspace, range)
  ])

  return {
    export: data,
    previousTotals,
    categoryTotals: [],
    score: { status: "insufficient", reasons: [] },
    reportsUrl: reportsUrlFor(workspace, range, today)
  }
}
