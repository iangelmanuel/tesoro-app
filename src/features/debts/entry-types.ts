import type { DebtKind, ReceivableSchedule } from "./schemas"

// Tipos de movimiento de una deuda en el formulario de edición (SPEC 42,
// parte 3). Cada tipo de la pantalla se guarda como un kind de debt_entries:
// el abono es un pago extra y la compra y el avance son el mismo kind (la
// cuenta decide cuál es).

export const ENTRY_TYPES = [
  "payment",
  "extra",
  "purchase",
  "advance",
  "fee",
  "adjustment"
] as const

export type EntryType = (typeof ENTRY_TYPES)[number]

/** Sube o baja el saldo: solo para el ajuste */
export const ADJUSTMENT_DIRECTIONS = ["up", "down"] as const

export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number]

export type EntryKind = "payment" | "advance" | "fee" | "adjustment"

/** Lo que el formulario necesita de la deuda para elegir tipos */
export interface EntryTypeDebt {
  kind: DebtKind
  schedule: ReceivableSchedule | null
}

/** Lo que el formulario necesita del movimiento para su tipo actual */
export interface EntryTypeSource {
  kind: EntryKind
  is_extra_payment: boolean
  /** Cuenta del pago o avance; null = sin cuenta */
  payment_account_id: string | null
}

interface EntryTypeInfo {
  label: string
  /** Una línea bajo el nombre en el selector */
  hint: string
}

/** Nombre y ayuda de cada tipo según la deuda */
export function entryTypeInfo(
  type: EntryType,
  debtKind: DebtKind
): EntryTypeInfo {
  const isReceivable = debtKind === "receivable"
  switch (type) {
    case "payment":
      return isReceivable
        ? { label: "Cobro", hint: "Lo que te pagaron. Baja lo que te deben." }
        : {
            label: "Pago",
            hint:
              debtKind === "loan"
                ? "La cuota del mes. Baja el saldo."
                : "El pago del mes. Baja el saldo."
          }
    case "extra":
      return {
        label: "Abono",
        hint: "Pago extra a capital. Baja el saldo, no cubre el pago del mes."
      }
    case "purchase":
      return {
        label: "Compra",
        hint: "Sube el saldo. Puede ir a cuotas. No toca tus cuentas."
      }
    case "advance":
      return {
        label: "Avance",
        hint: "Retiro o avance a una cuenta. Sube el saldo y entra a la cuenta."
      }
    case "fee":
      return {
        label: "Cuota de manejo",
        hint: "Lo que cobra el banco cada mes. Sube el saldo."
      }
    case "adjustment":
      return {
        label: "Ajuste",
        hint: "Corrige el saldo: intereses, cargos del banco o el extracto."
      }
  }
}

/**
 * Tipos que admite una deuda. Una cuenta por cobrar mensual no lleva ajustes
 * nuevos: solo conserva el que ya es ajuste
 */
export function entryTypesFor(
  debt: EntryTypeDebt,
  current?: EntryType
): EntryType[] {
  switch (debt.kind) {
    case "credit_card":
      return ["payment", "extra", "purchase", "advance", "fee", "adjustment"]
    case "loan":
      return ["payment", "extra", "adjustment"]
    case "receivable":
      return debt.schedule === "monthly" && current !== "adjustment"
        ? ["payment"]
        : ["payment", "adjustment"]
  }
}

/** Tipo de la pantalla para un movimiento guardado */
export function entryTypeOf(entry: EntryTypeSource): EntryType {
  switch (entry.kind) {
    case "payment":
      return entry.is_extra_payment ? "extra" : "payment"
    case "advance":
      return entry.payment_account_id ? "advance" : "purchase"
    case "fee":
      return "fee"
    case "adjustment":
      return "adjustment"
  }
}

/** kind de debt_entries que guarda cada tipo */
export function entryKindOf(type: EntryType): EntryKind {
  switch (type) {
    case "payment":
    case "extra":
      return "payment"
    case "purchase":
    case "advance":
      return "advance"
    case "fee":
      return "fee"
    case "adjustment":
      return "adjustment"
  }
}

/**
 * Cómo mueve el saldo de la deuda un movimiento: el pago lo baja; la compra,
 * el avance y la cuota lo suben; el ajuste según su signo
 */
export function balanceEffect(kind: EntryKind, amount: number) {
  return kind === "payment" ? -amount : amount
}
