import type { Content } from "pdfmake/interfaces"
import { movementColumns, movementTone } from "../../columns"
import type { ExportMovementRow } from "../../types"
import type { PdfContext } from "../types"
import { type PdfColumn, pdfTable } from "./table"

type Row = ExportMovementRow

/** Origen → Destino en los traspasos; la cuenta en el resto */
function accountLabel(row: Row) {
  if (row.kind === "Traspaso" && row.destination) {
    return `${row.account ?? ""} → ${row.destination}`
  }
  return row.account
}

/**
 * Vertical: 5 columnas, los traspasos muestran "Origen → Destino" en Cuenta.
 * Ventas y Costos y gastos de Empresa usan las mismas
 */
export const PORTRAIT_MOVEMENT_COLUMNS: PdfColumn<Row>[] = [
  { header: "Fecha", kind: "date", value: (row) => row.date },
  { header: "Descripción", kind: "text", value: (row) => row.description },
  { header: "Categoría", kind: "text", value: (row) => row.category },
  { header: "Cuenta", kind: "text", value: accountLabel },
  {
    header: "Monto",
    kind: "money",
    value: (row) => row.amount,
    tone: movementTone
  }
]

/**
 * Horizontal: las 9 columnas de la hoja Movimientos del Excel de Personal,
 * sin Mes. Tipo toma el ancho de su contenido
 */
const LANDSCAPE_COLUMNS: PdfColumn<Row>[] = movementColumns("personal")
  .filter((column) => column.key !== "month")
  .map((column) => ({
    header: column.header,
    kind: column.kind,
    value: (row: Row) => row[column.key],
    tone: column.kind === "money" ? movementTone : undefined,
    width: column.key === "kind" ? "auto" : undefined
  }))

export const isLandscape = (ctx: PdfContext) => ctx.page.width > ctx.page.height

/**
 * Movimientos del mes de Personal: tabla compacta (8 pt) con todos, en el
 * orden en que llegan (fecha y `day_position`, igual que el Excel).
 * Descripciones y notas del usuario van como texto plano.
 */
export function movementsTable(
  ctx: PdfContext,
  rows: Row[],
  options: { emptyText?: string } = {}
): Content {
  return pdfTable(ctx, {
    title: "Movimientos",
    columns: isLandscape(ctx) ? LANDSCAPE_COLUMNS : PORTRAIT_MOVEMENT_COLUMNS,
    rows,
    emptyText: options.emptyText,
    compact: true
  })
}
