import { SITE } from "@/config/site"
import {
  BUSINESS_FACTOR_LABELS,
  BUSINESS_MONTH_FACTORS
} from "@/features/business-score/constants"
import { getBusinessScoreHistory } from "@/features/business-score/queries"
import { getBusinessRecommendations } from "@/features/business-score/recommendations"
import { type ReportQuery, buildReportQuery } from "@/features/reports/period"
import { getCategoryTotals, getMonthlyTotals } from "@/features/reports/queries"
import {
  FACTOR_LABELS,
  MONTH_FACTORS,
  SEVERITY_LABELS
} from "@/features/score/constants"
import { bandInfo, hasScore, isIncluded } from "@/features/score/curves"
import {
  getDismissedRecommendations,
  getScoreHistory
} from "@/features/score/queries"
import {
  getRecommendations,
  splitDismissed
} from "@/features/score/recommendations"
import type {
  FactorResult,
  Recommendation,
  ScoreResult
} from "@/features/score/types"
import { workspaceReportsPath } from "@/features/workspaces/paths"
import type { Workspace } from "@/features/workspaces/queries"
import { monthRange } from "@/libs/dates"
import { loadExportData } from "../queries"
import { previousRange } from "../range"
import type { ExportRange } from "../types"
import { html } from "./rich-text"
import type { PdfReportData, PdfScore } from "./types"

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

/**
 * Gastos (costos en Empresa) por categoría del periodo, de mayor a menor,
 * con la misma RPC que las gráficas de Reportes
 */
async function loadCategoryTotals(workspace: Workspace, range: ExportRange) {
  const rows = await getCategoryTotals(
    workspace.id,
    `${range.from}-01`,
    monthRange(range.to).to,
    "expense"
  )
  return rows.map((row) => ({ name: row.name, total: row.total }))
}

const PERCENT_FORMAT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1
})

const DECIMAL_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1
})

/** El dato del factor como en la pantalla: meses o porcentaje */
function factorValue(value: number, inMonths: boolean) {
  if (inMonths) {
    return `${DECIMAL_FORMAT.format(value)} ${value === 1 ? "mes" : "meses"}`
  }
  return PERCENT_FORMAT.format(value)
}

/**
 * Score y recomendaciones en la forma del PDF. Título y dato de cada
 * recomendación pasan por `html`, que escapa todo: pueden traer nombres de
 * categorías, metas o cuentas del usuario
 */
function toPdfScore<K extends string>(
  current: ScoreResult<K>,
  labels: Record<K, string>,
  monthFactors: readonly K[],
  active: Recommendation<string>[]
): PdfScore {
  if (!hasScore(current)) {
    return { status: "insufficient", reasons: current.insufficient }
  }

  return {
    status: "ok",
    value: current.score,
    band: bandInfo(current.band).label,
    factors: current.factors.map((factor: FactorResult<K>) => ({
      name: labels[factor.key],
      weight: factor.weight,
      value: isIncluded(factor)
        ? factorValue(factor.value, monthFactors.includes(factor.key))
        : "—",
      state: isIncluded(factor)
        ? `${Math.round(factor.points)} pts`
        : `Excluido: ${factor.excluded}`
    })),
    recommendations: active.map((item) => ({
      title: item.title,
      html: html`<p>
        <strong
          >Prioridad ${SEVERITY_LABELS[item.severity].toLowerCase()}.</strong
        >
        ${item.evidence}
      </p>`
    }))
  }
}

/**
 * Score actual (al día de generación) con las mismas consultas que la
 * pantalla de Recomendaciones (SPEC 07 y 11) y solo las recomendaciones
 * activas: las ocultas este mes no salen
 */
async function loadScore(
  workspace: Workspace,
  today: string
): Promise<PdfScore> {
  const month = today.slice(0, 7)

  if (workspace.type === "personal") {
    const { inputs, history } = await getScoreHistory(workspace.id, today)
    const [recommendations, dismissed] = await Promise.all([
      getRecommendations(workspace.id, inputs),
      getDismissedRecommendations(workspace.id, month)
    ])
    const { active } = splitDismissed(recommendations, dismissed)
    return toPdfScore(history.at(-1)!, FACTOR_LABELS, MONTH_FACTORS, active)
  }

  const { inputs, history } = await getBusinessScoreHistory(workspace.id, today)
  const [recommendations, dismissed] = await Promise.all([
    getBusinessRecommendations(workspace, inputs),
    getDismissedRecommendations(workspace.id, month)
  ])
  const { active } = splitDismissed(recommendations, dismissed)
  return toPdfScore(
    history.at(-1)!,
    BUSINESS_FACTOR_LABELS,
    BUSINESS_MONTH_FACTORS,
    active
  )
}

// Datos del PDF (SPEC 33), con la sesión del usuario y RLS. Parte de
// `loadExportData` (SPEC 32) para que los totales cuadren con el Excel.
export async function loadPdfData(
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<PdfReportData> {
  const [data, previousTotals, categoryTotals, score] = await Promise.all([
    loadExportData(workspace, range, today),
    loadPreviousTotals(workspace, range),
    loadCategoryTotals(workspace, range),
    loadScore(workspace, today)
  ])

  return {
    export: data,
    previousTotals,
    categoryTotals,
    score,
    reportsUrl: reportsUrlFor(workspace, range, today)
  }
}
