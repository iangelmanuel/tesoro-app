import type { Workbook } from "exceljs"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { movementColumns } from "../columns"
import type { ExportMovementKind, ExportMovementRow } from "../types"
import { type SectionColumn, writeSection } from "./section"
import { type AmountTone, accentColor, applyPrintSetup } from "./theme"

export const MOVEMENTS_SHEET = "Movimientos"

const KIND_TONES: Record<ExportMovementKind, AmountTone> = {
  Ingreso: "income",
  Venta: "income",
  Gasto: "expense",
  "Costo o gasto": "expense",
  Traspaso: "transfer"
}

/** Color del monto según el tipo del movimiento */
export function movementTone(row: ExportMovementRow) {
  return KIND_TONES[row.kind]
}

/** Columnas de movimientos como columnas de sección, con el color del monto */
export function movementSectionColumns(
  type: WorkspaceType,
  options: { withMonth: boolean }
): SectionColumn<ExportMovementRow, keyof ExportMovementRow & string>[] {
  return movementColumns(type)
    .filter((column) => options.withMonth || column.key !== "month")
    .map((column) => ({
      ...column,
      tone: column.kind === "money" ? movementTone : undefined
    }))
}

/**
 * Hoja plana con todos los movimientos y traspasos del periodo: encabezado
 * inmovilizado y autofiltro, para filtrar o armar tablas dinámicas
 */
export function addMovementsSheet(
  workbook: Workbook,
  type: WorkspaceType,
  rows: ExportMovementRow[]
) {
  const sheet = workbook.addWorksheet(MOVEMENTS_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }]
  })
  const columns = movementSectionColumns(type, { withMonth: true })

  const section = writeSection(sheet, accentColor(type), {
    startRow: 1,
    columns,
    rows,
    emptyText: "Sin movimientos en este periodo"
  })

  sheet.autoFilter = {
    from: { row: section.headerRow, column: 1 },
    to: { row: section.lastRow, column: columns.length }
  }

  applyPrintSetup(sheet)
  return sheet
}
