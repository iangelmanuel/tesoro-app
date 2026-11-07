import ExcelJS from "exceljs"
import type { Workspace } from "@/features/workspaces/queries"
import type { ExportData } from "../queries"
import { addMovementsSheet } from "./movements-sheet"
import { addPersonalMonthSheet } from "./personal-month-sheet"

// Libro de la exportación. Orden de las hojas: Resumen, una por mes (de la
// más antigua a la más reciente) y Movimientos. `today` es YYYY-MM-DD en
// America/Bogota: marca el mes en curso.
export async function buildWorkbook(
  workspace: Workspace,
  data: ExportData,
  today: string
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Tesoro"
  workbook.created = new Date()
  workbook.title =
    workspace.type === "personal"
      ? "Tesoro · Personal"
      : `Tesoro · ${workspace.name}`

  if (data.type === "personal") {
    for (const month of data.months) {
      addPersonalMonthSheet(workbook, month, today)
    }
  }

  addMovementsSheet(workbook, workspace.type, data.movements)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
