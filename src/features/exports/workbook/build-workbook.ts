import ExcelJS from "exceljs"
import type { Workspace } from "@/features/workspaces/queries"
import type { ExportData } from "../queries"
import type { ExportRange } from "../types"
import { addBusinessMonthSheet } from "./business-month-sheet"
import { addMovementsSheet } from "./movements-sheet"
import { addPersonalMonthSheet } from "./personal-month-sheet"
import { addSummarySheet, fillSummarySheet, periodLabel } from "./summary-sheet"

// Libro de la exportación. Orden de las hojas: Resumen, una por mes (de la
// más antigua a la más reciente) y Movimientos. `today` es YYYY-MM-DD en
// America/Bogota: marca el mes en curso.
export async function buildWorkbook(
  workspace: Workspace,
  data: ExportData,
  range: ExportRange,
  today: string
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Tesoro"
  workbook.created = new Date()
  workbook.title =
    workspace.type === "personal"
      ? "Tesoro · Personal"
      : `Tesoro · ${workspace.name}`

  // Resumen va primero, pero sus fórmulas apuntan a las hojas de mes
  const summary = addSummarySheet(workbook)

  const months =
    data.type === "personal"
      ? data.months.map((month) =>
          addPersonalMonthSheet(workbook, month, today)
        )
      : data.months.map((month) =>
          addBusinessMonthSheet(workbook, workspace.name, month, today)
        )

  addMovementsSheet(
    workbook,
    workspace.type,
    data.movements,
    periodLabel(range)
  )

  fillSummarySheet(workbook, summary, {
    type: workspace.type,
    workspaceName: workspace.name,
    range,
    months,
    today
  })

  // Excel recalcula todo al abrir; los visores sin motor usan `result`
  workbook.calcProperties.fullCalcOnLoad = true

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
