import { Banknote, CreditCard, PiggyBank } from "lucide-react"
import { isAccountMovementKind } from "./ledger-entry"
import type { AccountMovementKind, LedgerEntry, LinkedDebtEntry } from "./types"

// Lógica de las filas de la tabla de Movimientos: llaves, orden manual del
// día (SPEC 19) y textos de pagos, avances y aportes. Puro: lo usa
// TransactionsTable y se prueba sin React.

/** Movimiento: entrada o salida */
export type TransactionEntry = Extract<LedgerEntry, { transaction: unknown }>
/** Traspaso entre cuentas */
export type TransferEntry = Extract<LedgerEntry, { kind: "transfer" }>
/** Ajuste de saldo */
export type AdjustmentEntry = Extract<LedgerEntry, { kind: "adjustment" }>
/** Pago o avance de tarjeta, o aporte de meta, con cuenta */
export type AccountMovementEntry = Extract<
  LedgerEntry,
  { kind: AccountMovementKind }
>

/** Reordenar una fila dentro de su día arrastrando su asa (⋮⋮) */
export interface Reorder {
  /** Llave de la fila: `kind:id` */
  id: string
  day: string
  /** Posición de la fila entre las de su mismo día a la vista */
  index: number
  /** Hay otra fila de su día a la vista: sin ella no hay nada que reordenar */
  canDrag: boolean
  /** Texto de la fila para la vista previa del arrastre */
  title: string
  /** Resaltado mientras se arrastra otra fila */
  className?: string
}

/** Id de la fila en su tabla de origen (el mismo que usa move_ledger_entry) */
export function entryId(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.id : row.id
}

/** Fecha de la fila (YYYY-MM-DD) */
export function entryDate(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.occurred_on : row.occurred_on
}

/** Llave única de la fila en la tabla: `kind:id` */
export function rowKey(row: LedgerEntry) {
  return `${row.kind}:${entryId(row)}`
}

/** La fila es un pago, avance o aporte con cuenta */
export function isAccountMovement(
  row: LedgerEntry
): row is AccountMovementEntry {
  return isAccountMovementKind(row.kind)
}

/**
 * Pagos, avances y aportes con cuenta: el texto de la fila y si el saldo de
 * la cuenta sube (+) o baja (−). Un retiro de meta (monto < 0) entra a la
 * cuenta.
 */
export function describeAccountMovement(entry: AccountMovementEntry) {
  switch (entry.kind) {
    case "debt_payment":
      return {
        title: `${entry.is_extra_payment ? "Abono" : "Pago"} · ${entry.name}`,
        type: entry.is_extra_payment ? "Abono a tarjeta" : "Pago de tarjeta",
        icon: CreditCard,
        increases: false
      }
    case "debt_advance":
      return {
        title: `Avance · ${entry.name}`,
        type: "Avance de tarjeta",
        icon: Banknote,
        increases: true
      }
    case "goal_contribution":
      return entry.amount < 0
        ? {
            title: `Retiro · ${entry.name}`,
            type: "Retiro de meta",
            icon: PiggyBank,
            increases: true
          }
        : {
            title: `Aporte · ${entry.name}`,
            type: "Aporte a meta",
            icon: PiggyBank,
            increases: false
          }
  }
}

/** Toast al eliminar un pago, avance o aporte con cuenta */
export function accountMovementDeletedText(entry: AccountMovementEntry) {
  if (entry.kind === "goal_contribution") {
    return `${entry.amount < 0 ? "Retiro" : "Aporte"} eliminado`
  }
  if (entry.kind === "debt_advance") {
    return "Avance eliminado"
  }
  return `${entry.is_extra_payment ? "Abono" : "Pago"} eliminado`
}

/**
 * Cómo se nombra el abono enlazado a un movimiento: avance de tarjeta, cobro
 * de un Me deben o pago de préstamo
 */
export function linkedPaymentNoun(
  entry: Pick<LinkedDebtEntry, "kind" | "debt_kind">
) {
  if (entry.kind === "advance") return "avance"
  return entry.debt_kind === "receivable" ? "cobro" : "pago"
}

/** Texto corto de la fila para la vista previa del arrastre */
export function rowTitle(row: LedgerEntry) {
  if ("transaction" in row) {
    return row.transaction.description
  }
  switch (row.kind) {
    case "transfer":
      return "Traspaso"
    case "adjustment":
      return "Ajuste de saldo"
    default:
      return describeAccountMovement(row).title
  }
}

/**
 * La fila origen toma el lugar de la destino: sube antes de ella, baja
 * después. Sin alguna de las dos, deja el orden igual.
 */
export function reorderRows(
  current: LedgerEntry[],
  move: { sourceKey: string; targetKey: string }
) {
  const from = current.findIndex((row) => rowKey(row) === move.sourceKey)
  const to = current.findIndex((row) => rowKey(row) === move.targetKey)

  if (from === -1 || to === -1) {
    return current
  }

  const next = [...current]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * Datos de reordenar de cada fila, en el orden de la tabla: su posición
 * entre las de su día y si tiene asa (un día de una sola fila a la vista no
 * la tiene). Mientras se arrastra, las filas del mismo día se resaltan como
 * zona de soltado y el resto se atenúa.
 */
export function rowReorders(
  rows: LedgerEntry[],
  draggingDay: string | null
): Reorder[] {
  const dayCounts = new Map<string, number>()

  return rows.map((row, index) => {
    const day = entryDate(row)
    const previous = rows[index - 1]
    const next = rows[index + 1]
    const dayIndex = dayCounts.get(day) ?? 0
    dayCounts.set(day, dayIndex + 1)

    return {
      id: rowKey(row),
      day,
      index: dayIndex,
      canDrag: Boolean(
        (previous && entryDate(previous) === day) ||
        (next && entryDate(next) === day)
      ),
      title: rowTitle(row),
      className: draggingDay
        ? day === draggingDay
          ? "bg-primary/10"
          : "opacity-40"
        : undefined
    }
  })
}
