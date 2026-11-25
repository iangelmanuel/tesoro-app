import { amountInput } from "@/components/forms/amount-format"
import type { DebtKind } from "./debt-schemas"
import { type EntryType, entryTypesFor } from "./entry-types"
import type { DebtPaymentDescriptions } from "./payment-description"
import type { Debt } from "./queries"

// Prellenado y textos del formulario de un movimiento nuevo de una deuda
// (PaymentDialog, SPEC 41, 46 y 49). Puro: lo usa el diálogo (cliente).

/**
 * Tipo del movimiento nuevo (SPEC 46): los mismos del editor (SPEC 42).
 * Pago y Abono van por recordPayment, Compra y Avance por recordAdvance, y
 * Cuota de manejo y Ajuste por recordDebtCharge
 */
export type PaymentMode = EntryType

/**
 * Prellenado de un movimiento nuevo de la deuda (Duplicar, SPEC 49). Sin fecha
 * ni hora: ocurre hoy. Una cuenta archivada llega como null. La categoría no
 * se copia: crear asigna la de siempre
 */
export interface PaymentInitialValues {
  /** Nunca "adjustment": los ajustes no se duplican */
  mode: Exclude<PaymentMode, "adjustment">
  amount: number
  account_id: string | null
  /** Descripción del movimiento enlazado; vacía si el original no tenía */
  description: string
  note: string
  /** Cuotas de una compra o avance */
  installments?: number | null
}

/** Lo que el formulario necesita de la deuda */
export type PaymentDebt = Pick<Debt, "id" | "kind"> & {
  /** Cuenta por defecto (SPEC 41): se prellena al registrar si sigue activa */
  account_id?: string | null
  /** Descripción prellenada del movimiento (SPEC 41); sin ella, vacía */
  descriptions?: DebtPaymentDescriptions
  /**
   * La cuota del ciclo actual ya está cubierta (`nextPayment(debt).status ===
   * "paid"`): un Pago nuevo muestra un aviso, sin bloquear (SPEC 49)
   */
  cycleCovered?: boolean
}

/** Un abono baja el saldo, pero el mínimo o la cuota del mes sigue pendiente */
export const EXTRA_EFFECT =
  "No cubre el pago del mes: el próximo pago sigue pendiente."

const PAYMENT_TOASTS: Record<PaymentMode, string> = {
  payment: "Pago registrado",
  extra: "Abono registrado",
  purchase: "Compra registrada",
  advance: "Avance registrado",
  fee: "Cuota de manejo registrada",
  adjustment: "Ajuste registrado"
}

/** Toast al registrar: en una cuenta por cobrar siempre es un abono */
export function paymentToast(mode: PaymentMode, kind: DebtKind) {
  return kind === "receivable" ? "Abono registrado" : PAYMENT_TOASTS[mode]
}

/**
 * Tipos que ofrece el formulario: los mismos del editor (SPEC 42). Una cuenta
 * por cobrar llega aquí solo para abonar: su cobro va por
 * ReceivableCollectForm
 */
export function paymentModes(kind: DebtKind): PaymentMode[] {
  return kind === "receivable"
    ? ["payment"]
    : entryTypesFor({ kind, schedule: null })
}

/** Tipo inicial: el del duplicado si la deuda lo admite; si no, Pago */
export function initialPaymentMode(
  modes: PaymentMode[],
  initialValues?: PaymentInitialValues
): PaymentMode {
  return initialValues && modes.includes(initialValues.mode)
    ? initialValues.mode
    : "payment"
}

/** Server action que registra cada tipo */
export function paymentAction(mode: PaymentMode) {
  if (mode === "purchase" || mode === "advance") return "advance" as const
  if (mode === "payment" || mode === "extra") return "payment" as const
  return "charge" as const
}

/**
 * Monto prellenado (SPEC 41): el Pago arranca con lo que falta de la cuota;
 * los demás tipos, vacíos
 */
export function prefilledAmount(
  mode: PaymentMode,
  descriptions?: DebtPaymentDescriptions
) {
  return mode === "payment" ? amountInput(descriptions?.amount) : ""
}

/** Descripción prellenada según Pago o Abono (SPEC 41); undefined sin ella */
export function prefilledDescription(
  mode: PaymentMode,
  descriptions?: DebtPaymentDescriptions
) {
  return descriptions?.[mode === "extra" ? "extra" : "payment"]
}

/**
 * Nota prellenada del movimiento en el historial de la deuda: en Pago y
 * Abono, el mismo texto que la descripción ("Pago {nombre} · {mes}"); en una
 * tarjeta es el único texto del pago. Los demás tipos arrancan vacíos
 */
export function prefilledNote(
  mode: PaymentMode,
  descriptions?: DebtPaymentDescriptions
) {
  return mode === "payment" || mode === "extra"
    ? (prefilledDescription(mode, descriptions) ?? "")
    : ""
}

/**
 * Cuenta prellenada: la del duplicado mientras no se cambie entre avance y
 * pago; el avance arranca sin cuenta (la cuenta por defecto es la que paga la
 * tarjeta, no la que recibe un avance); los demás, la cuenta por defecto
 */
export function prefilledAccount(
  mode: PaymentMode,
  context: {
    initialValues?: PaymentInitialValues
    initialMode: PaymentMode
    /** Cuenta por defecto de la deuda si sigue activa, o "" */
    defaultAccountId: string
  }
) {
  const { initialValues, initialMode, defaultAccountId } = context
  if (initialValues && (mode === "advance") === (initialMode === "advance")) {
    return initialValues.account_id ?? ""
  }
  return mode === "advance" ? "" : defaultAccountId
}

/**
 * Un campo prellenado se reemplaza al cambiar de tipo solo si está vacío o
 * sigue con el prellenado: se respeta lo que el usuario escriba
 */
export function keepsPrefill(current: string, prefilled: string) {
  return current === "" || current === prefilled
}

/** Efecto real del movimiento en una tarjeta según el tipo y la cuenta */
export function cardEffect(mode: PaymentMode, accountName: string | null) {
  switch (mode) {
    case "purchase":
      return "Es una compra: no toca tus cuentas, solo sube el saldo de la tarjeta. Si es a cuotas, cada cuota suma al pago del mes."
    case "advance":
      return accountName
        ? `Es un avance: entra dinero a ${accountName} como entrada (Avance de tarjeta) y sube la deuda de la tarjeta.`
        : "Elige la cuenta a la que entró el avance."
    case "fee":
      return "Sube el saldo de la tarjeta. No toca tus cuentas."
    case "adjustment":
      return "Corrige el saldo de la tarjeta. No toca tus cuentas ni crea movimiento."
    default: {
      const effect = accountName
        ? `Mueve dinero de ${accountName} a la tarjeta. No cuenta como salida.`
        : `Este ${mode === "extra" ? "abono" : "pago"} no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son salidas.`
      return mode === "extra" ? `${effect} ${EXTRA_EFFECT}` : effect
    }
  }
}

/** Placeholder de la nota según el tipo */
export function notePlaceholder(mode: PaymentMode, isReceivable: boolean) {
  if (isReceivable) return "Primer abono"
  switch (mode) {
    case "purchase":
      return "Compra en el supermercado"
    case "advance":
      return "Avance en cajero"
    case "fee":
      return "Cuota de manejo de noviembre"
    case "adjustment":
      return "Intereses del extracto"
    case "extra":
      return "Abono a capital"
    default:
      return "Cuota de noviembre"
  }
}
