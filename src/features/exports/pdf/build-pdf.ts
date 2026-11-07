import type { Content, TDocumentDefinitions } from "pdfmake/interfaces"
import { SITE } from "@/config/site"
import type { Workspace } from "@/features/workspaces/queries"
import { formatGenerated, monthLabel } from "../range"
import type { ExportRange, PdfOptions } from "../types"
import { getPdfmake } from "./fonts"
import { pdfFooter } from "./layout/footer"
import { pdfHeader } from "./layout/header"
import { pageSetup } from "./page"
import { businessMonthSection } from "./sections/business-month"
import { coverSection } from "./sections/cover"
import { personalMonthSection } from "./sections/personal-month"
import { keepTitlesWithTables } from "./sections/table"
import { pdfTheme } from "./theme"
import type { PdfContext, PdfReportData } from "./types"

/**
 * "Octubre 2026", "Enero – Octubre 2026" (mismo año),
 * "Noviembre 2025 – Octubre 2026". Si el último mes es el actual, termina en
 * " (en curso)"
 */
export function pdfPeriodLabel(
  range: Pick<ExportRange, "from" | "to">,
  today: string
) {
  const suffix = range.to === today.slice(0, 7) ? " (en curso)" : ""
  if (range.from === range.to) return `${monthLabel(range.from)}${suffix}`

  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4)
  const from = sameYear
    ? monthLabel(range.from).split(" ")[0]
    : monthLabel(range.from)

  return `${from} – ${monthLabel(range.to)}${suffix}`
}

// Reporte PDF de un espacio (SPEC 33). Orden: portada, resumen del periodo,
// gráficas, score y detalle por mes; cada parte arranca en página nueva.
// `today` es YYYY-MM-DD en America/Bogota.
export async function buildPdf(
  workspace: Workspace,
  data: PdfReportData,
  range: ExportRange,
  today: string,
  options: PdfOptions
) {
  const workspaceName =
    workspace.type === "personal" ? "Personal" : workspace.name
  const period = pdfPeriodLabel(range, today)

  const ctx: PdfContext = {
    type: workspace.type,
    theme: pdfTheme(workspace.type, options.theme),
    page: pageSetup(options),
    workspaceName,
    period,
    generated: formatGenerated(today),
    today
  }

  // Detalle por mes, en orden cronológico. Resumen, gráficas y score
  // llegan en los pasos 10 a 12
  const monthSections: Content[] =
    data.export.type === "personal"
      ? data.export.months.flatMap((month) => personalMonthSection(ctx, month))
      : data.export.months.flatMap((month) => businessMonthSection(ctx, month))
  const sections: Content[] = [...monthSections]

  const doc: TDocumentDefinitions = {
    info: {
      title: `Tesoro · ${workspaceName} · ${period}`,
      author: "Tesoro",
      subject: "Reporte financiero",
      creator: `Tesoro ${SITE.info.version}`,
      producer: `Tesoro ${SITE.info.version}`
    },
    language: "es-CO",
    pageSize: ctx.page.pageSize,
    pageOrientation: ctx.page.pageOrientation,
    pageMargins: ctx.page.pageMargins,
    header: pdfHeader(ctx),
    footer: pdfFooter(ctx),
    pageBreakBefore: keepTitlesWithTables,
    styles: ctx.theme.styles,
    defaultStyle: ctx.theme.defaultStyle,
    content: [coverSection(ctx, data.reportsUrl), ...sections]
  }

  return getPdfmake().createPdf(doc).getBuffer()
}
