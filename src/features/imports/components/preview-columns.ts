import type { ReactNode } from "react"
import { formatCurrency, formatDate } from "@/libs/format"
import { MONTH_NAMES } from "../constants"
import type {
  DebtEntryValue,
  GoalContributionValue,
  RecurringValue,
  TransactionValue
} from "../types"

// Columnas de datos de la vista previa (paso 5), por destino

const TYPE_LABELS = { income: "Entrada", expense: "Salida" } as const

/** Columna de datos normalizados de la vista previa */
export interface PreviewColumn<V> {
  header: string
  className?: string
  cell: (value: V) => ReactNode
}

/** Clase de las celdas de monto; el encabezado se alinea igual */
export const AMOUNT_CLASS = "text-right whitespace-nowrap tabular-nums"

/** Movimientos; la columna Cuenta solo con Método mapeado */
export function transactionColumns(
  currency: string,
  categoryNames: Record<string, string>,
  /** Solo con la columna Método mapeada */
  accountNames?: Record<string, string>
): PreviewColumn<TransactionValue>[] {
  const columns: PreviewColumn<TransactionValue>[] = [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Tipo", cell: (value) => TYPE_LABELS[value.type] },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(value.amount, currency)
    },
    {
      header: "Categoría",
      cell: (value) => categoryNames[value.categoryKey] ?? "—"
    },
    {
      header: "Descripción",
      className: "max-w-64 truncate",
      cell: (value) => value.description
    }
  ]

  if (accountNames) {
    columns.splice(4, 0, {
      header: "Cuenta",
      cell: (value) =>
        value.accountKey === null
          ? "Sin cuenta"
          : (accountNames[value.accountKey] ?? "—")
    })
  }
  return columns
}

/** "Mensual, día 5" o "Anual, 15 de marzo" */
export function frequencyText(value: RecurringValue) {
  if (value.frequency === "monthly") return `Mensual, día ${value.day_of_month}`
  const month = MONTH_NAMES[(value.month_of_year ?? 1) - 1]
  return `Anual, ${value.day_of_month} de ${month}`
}

/** Gastos fijos */
export function recurringColumns(
  currency: string,
  categoryNames: Record<string, string>
): PreviewColumn<RecurringValue>[] {
  return [
    {
      header: "Nombre",
      className: "max-w-64 truncate",
      cell: (value) => value.name
    },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(value.amount, currency)
    },
    {
      header: "Categoría",
      cell: (value) => categoryNames[value.categoryKey] ?? "—"
    },
    {
      header: "Frecuencia",
      className: "whitespace-nowrap",
      cell: frequencyText
    },
    {
      header: "Inicio",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.starts_on)
    },
    {
      header: "Fin",
      className: "whitespace-nowrap",
      cell: (value) => (value.ends_on ? formatDate(value.ends_on) : "—")
    }
  ]
}

/** Pago, Cargo (ajuste > 0) o Ajuste que baja el saldo (ajuste < 0) */
export function debtEntryLabel(value: DebtEntryValue) {
  if (value.kind === "payment") return "Pago"
  return value.amount > 0 ? "Cargo" : "Ajuste que baja el saldo"
}

/** Pagos y ajustes de deudas */
export function debtEntryColumns(
  currency: string,
  debtNames: Record<string, string>
): PreviewColumn<DebtEntryValue>[] {
  return [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Deuda", cell: (value) => debtNames[value.debtId] ?? "—" },
    { header: "Tipo", cell: debtEntryLabel },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(Math.abs(value.amount), currency)
    },
    {
      header: "Nota",
      className: "max-w-64 truncate",
      cell: (value) => value.note ?? "—"
    }
  ]
}

/** Aportes y retiros de metas */
export function goalContributionColumns(
  currency: string,
  goalNames: Record<string, string>
): PreviewColumn<GoalContributionValue>[] {
  return [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Meta", cell: (value) => goalNames[value.goalId] ?? "—" },
    {
      header: "Tipo",
      cell: (value) => (value.amount < 0 ? "Retiro" : "Aporte")
    },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(Math.abs(value.amount), currency)
    },
    {
      header: "Nota",
      className: "max-w-64 truncate",
      cell: (value) => value.note ?? "—"
    }
  ]
}
