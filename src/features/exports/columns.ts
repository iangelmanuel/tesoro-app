import type { WorkspaceType } from "@/features/workspaces/queries"
import type { ExportMovementRow } from "./types"

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

const AMOUNT: MovementColumn = { header: "Monto", key: "amount", kind: "money" }

export function movementColumns(type: WorkspaceType): MovementColumn[] {
  return type === "business"
    ? [...BASE, ...BUSINESS, AMOUNT]
    : [...BASE, AMOUNT]
}
