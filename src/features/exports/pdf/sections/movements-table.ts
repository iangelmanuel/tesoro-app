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

// Vertical: 5 columnas, los traspasos muestran "Origen → Destino" en Cuenta
const PORTRAIT: PdfColumn<Row>[] = [
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

/** Columnas angostas en horizontal: toman el ancho de su contenido */
const AUTO_WIDTH = new Set<keyof Row>(["kind", "invoiceRef"])

/**
 * Horizontal: las mismas columnas de la hoja Movimientos del Excel sin Mes
 * (9 en Personal, 11 en Empresa con Contraparte y Factura)
 */
function landscapeColumns(ctx: PdfContext): PdfColumn<Row>[] {
  return movementColumns(ctx.type)
    .filter((column) => column.key !== "month")
    .map((column) => ({
      header: column.header,
      kind: column.kind,
      value: (row: Row) => row[column.key],
      tone: column.kind === "money" ? movementTone : undefined,
      width: AUTO_WIDTH.has(column.key) ? "auto" : undefined
    }))
}

/**
 * Tabla compacta (8 pt) con todos los movimientos, en el orden en que llegan
 * (fecha y `day_position`, igual que el Excel). Descripciones y notas del
 * usuario van como texto plano.
 */
export function movementsTable(
  ctx: PdfContext,
  rows: Row[],
  options: { title?: string; emptyText?: string } = {}
): Content {
  const landscape = ctx.page.width > ctx.page.height

  return pdfTable(ctx, {
    title: options.title ?? "Movimientos",
    columns: landscape ? landscapeColumns(ctx) : PORTRAIT,
    rows,
    emptyText: options.emptyText,
    compact: true
  })
}
