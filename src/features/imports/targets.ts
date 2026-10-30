import { SITE } from "@/config/site"
import { HEADER_SYNONYMS } from "./constants"
import type { ImportField, ImportTarget } from "./types"

// Destinos del asistente de importación (SPEC 08 y 08b). Cada importación
// tiene uno solo.

export interface TargetDefinition {
  /** Nombre en el selector y en el historial */
  label: string
  /** Unidad para contar filas: "1 gasto fijo", "3 gastos fijos" */
  unit: { one: string; other: string }
  /** Campos que se pueden mapear, en el orden del paso de columnas */
  fields: readonly ImportField[]
  /** Encabezados normalizados que sugieren cada campo, en orden de prioridad */
  synonyms: Partial<Record<ImportField, readonly string[]>>
  /** Página del destino, para el resumen */
  href: string
}

const PERSONAL = SITE.routes.dashboardPersonal

export const IMPORT_TARGETS: Record<ImportTarget, TargetDefinition> = {
  transactions: {
    label: "Movimientos",
    unit: { one: "movimiento", other: "movimientos" },
    fields: [
      "date",
      "amount",
      "type",
      "income_amount",
      "expense_amount",
      "category",
      "description",
      "note",
      "account"
    ],
    synonyms: HEADER_SYNONYMS,
    href: `${PERSONAL}/transactions`
  },
  recurring_expenses: {
    label: "Gastos fijos",
    unit: { one: "gasto fijo", other: "gastos fijos" },
    fields: [
      "name",
      "amount",
      "category",
      "frequency",
      "day_of_month",
      "month_of_year",
      "starts_on",
      "ends_on"
    ],
    synonyms: {
      name: ["nombre", "gasto", "concepto", "descripcion"],
      amount: ["monto", "valor", "importe", "cuota"],
      category: ["categoria", "rubro"],
      frequency: ["frecuencia", "periodicidad"],
      day_of_month: ["dia", "dia de pago", "vence"],
      month_of_year: ["mes"],
      starts_on: ["inicio", "desde", "fecha"],
      ends_on: ["fin", "hasta"]
    },
    href: `${PERSONAL}/budgets?tab=recurring`
  },
  debt_entries: {
    label: "Deudas",
    unit: { one: "pago o ajuste", other: "pagos y ajustes" },
    fields: ["date", "amount", "entry_type", "debt", "note"],
    synonyms: {
      date: ["fecha", "date", "dia"],
      amount: ["monto", "valor", "pago", "abono"],
      entry_type: ["tipo", "movimiento", "concepto"],
      debt: ["deuda", "tarjeta", "prestamo", "credito", "entidad"],
      note: ["nota", "descripcion", "detalle", "observacion"]
    },
    href: `${PERSONAL}/debts`
  },
  goal_contributions: {
    label: "Metas",
    unit: { one: "aporte o retiro", other: "aportes y retiros" },
    fields: ["date", "amount", "entry_type", "goal", "note"],
    synonyms: {
      date: ["fecha", "date", "dia"],
      amount: ["monto", "valor", "aporte"],
      entry_type: ["tipo", "movimiento"],
      goal: ["meta", "objetivo", "ahorro"],
      note: ["nota", "descripcion", "detalle", "observacion"]
    },
    href: `${PERSONAL}/goals`
  }
}

export const DEFAULT_TARGET: ImportTarget = "transactions"

export function isImportTarget(value: unknown): value is ImportTarget {
  return typeof value === "string" && Object.hasOwn(IMPORT_TARGETS, value)
}

/** `?target=` de la URL; un valor inválido cae a movimientos */
export function parseImportTarget(value: unknown): ImportTarget {
  return isImportTarget(value) ? value : DEFAULT_TARGET
}

/** "1 gasto fijo", "3 gastos fijos" */
export function countLabel(target: ImportTarget, count: number) {
  const { unit } = IMPORT_TARGETS[target]
  return `${count.toLocaleString("es-CO")} ${count === 1 ? unit.one : unit.other}`
}
