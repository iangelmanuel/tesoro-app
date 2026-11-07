import type { WorkspaceType } from "@/features/workspaces/queries"
import type { ExportMovementKind, ExportMovementRow } from "./types"
import type { AmountTone } from "./workbook/theme"

export type ColumnKind = "date" | "time" | "text" | "money" | "percent"

export interface MovementColumn {
  header: string
  key: keyof ExportMovementRow
  kind: ColumnKind
}

// Columnas de la hoja Movimientos y del CSV, en ese orden. Empresa suma
// Contraparte y Factura antes del monto.
const BASE: MovementColumn[] = [
  { header: "Mes", key: "month", kind: "text" },
  { header: "Fecha", key: "date", kind: "date" },
  { header: "Hora", key: "time", kind: "time" },
  { header: "Tipo", key: "kind", kind: "text" },
  { header: "Descripción", key: "description", kind: "text" },
  { header: "Categoría", key: "category", kind: "text" },
  { header: "Cuenta", key: "account", kind: "text" },
  { header: "Destino", key: "destination", kind: "text" },
  { header: "Nota", key: "note", kind: "text" }
]

const BUSINESS: MovementColumn[] = [
  { header: "Contraparte", key: "counterparty", kind: "text" },
  { header: "Factura", key: "invoiceRef", kind: "text" }
]

const KIND_TONES: Record<ExportMovementKind, AmountTone> = {
  Ingreso: "income",
  Venta: "income",
  Gasto: "expense",
  "Costo o gasto": "expense",
  Traspaso: "transfer"
}

/** Color (o signo, en el PDF) del monto según el tipo del movimiento */
export function movementTone(row: ExportMovementRow) {
  return KIND_TONES[row.kind]
}

const AMOUNT: MovementColumn = { header: "Monto", key: "amount", kind: "money" }

export function movementColumns(type: WorkspaceType): MovementColumn[] {
  return type === "business"
    ? [...BASE, ...BUSINESS, AMOUNT]
    : [...BASE, AMOUNT]
}
