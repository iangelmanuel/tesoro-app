import ExcelJS from "exceljs"
import type { Workspace } from "@/features/workspaces/queries"
import type { ExportData } from "../queries"
import { addMovementsSheet } from "./movements-sheet"

// Libro de la exportación. Orden de las hojas: Resumen, una por mes (de la
// más antigua a la más reciente) y Movimientos.
export async function buildWorkbook(workspace: Workspace, data: ExportData) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Tesoro"
  workbook.created = new Date()
  workbook.title =
    workspace.type === "personal"
      ? "Tesoro · Personal"
      : `Tesoro · ${workspace.name}`

  addMovementsSheet(workbook, workspace.type, data.movements)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}
