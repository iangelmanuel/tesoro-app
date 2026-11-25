import { amountInput } from "@/components/forms/amount-format"
import { roundCents } from "@/libs/money"
import type { DebtKind } from "./debt-schemas"
import {
  type AdjustmentDirection,
  type EntryKind,
  type EntryType,
  balanceEffect,
  entryKindOf,
  entryTransactionType,
  entryTypeOf,
  usesPaymentAccount
} from "./entry-types"
import type { DebtEntry, LinkableTransaction } from "./queries"

// Editor de un movimiento de deuda (DebtEntryDialog, SPEC 42 parte 3): valores
// iniciales, qué pide cada tipo, saldo proyectado y textos. Puro: lo usa el
// diálogo (cliente).

/** Valores del formulario de un movimiento guardado */
export function initialEntryForm(entry: DebtEntry): {
  type: EntryType
  amountText: string
  direction: AdjustmentDirection
  occurredOn: string
  time: string
  note: string
  accountId: string
  createTransaction: boolean
  description: string
} {
  return {
    type: entryTypeOf(entry),
    amountText: amountInput(Math.abs(entry.amount)),
    direction: entry.kind === "adjustment" && entry.amount < 0 ? "down" : "up",
    occurredOn: entry.occurred_on,
    time: entry.occurred_time?.slice(0, 5) ?? "",
    note: entry.note ?? "",
    accountId: entry.payment_account_id ?? "",
    // Un pago de préstamo o Me deben guardado sin movimiento lo conserva así;
    // un movimiento que pasa a pago arranca registrándolo
    createTransaction:
      entry.kind !== "payment" || entry.transaction_id !== null,
    description: entry.description ?? ""
  }
}

/** Qué campos pide el tipo elegido, según la deuda y el movimiento guardado */
export function entryFormFlags(context: {
  type: EntryType
  debtKind: DebtKind
  createTransaction: boolean
  entry: Pick<DebtEntry, "kind" | "transaction_id">
}) {
  const { type, debtKind, createTransaction, entry } = context
  const isCard = debtKind === "credit_card"
  const isReceivable = debtKind === "receivable"
  const kind = entryKindOf(type)
  const isPayment = kind === "payment"
  // Préstamo y Me deben: el pago puede registrar su gasto o ingreso
  const canCreateTransaction = isPayment && !isCard
  const createsTransaction = canCreateTransaction && createTransaction
  const usesAccount = usesPaymentAccount(type, isCard, createsTransaction)
  const transactionType = entryTransactionType(type, debtKind)
  return {
    isCard,
    isReceivable,
    kind,
    isPayment,
    canCreateTransaction,
    createsTransaction,
    showAccount: usesAccount,
    /** Pide la cuenta y los campos del movimiento (descripción, categoría) */
    accountRequired: createsTransaction || type === "advance",
    transactionType,
    // Ya lo registraste: un gasto o ingreso suelto que puede ser este. No
    // aplica al pago de tarjeta que ya era pago
    showLink:
      usesAccount &&
      (entry.transaction_id === null || kind !== entry.kind) &&
      !(isCard && isPayment && entry.kind === "payment")
  }
}

/**
 * Saldo de la deuda si se guarda el cambio: sin el efecto del movimiento
 * guardado y con el del nuevo. null si el monto no es válido
 */
export function projectedBalance(context: {
  debtBalance: number
  entry: Pick<DebtEntry, "kind" | "amount">
  kind: EntryKind
  type: EntryType
  amount: number
  direction: AdjustmentDirection
}) {
  const { debtBalance, entry, kind, type, amount, direction } = context
  if (Number.isNaN(amount) || amount <= 0) return null
  const signedAmount =
    type === "adjustment" && direction === "down" ? -amount : amount
  return roundCents(
    debtBalance -
      balanceEffect(entry.kind, entry.amount) +
      balanceEffect(kind, signedAmount)
  )
}

/** Lo que el tipo nuevo pide y aún falta ("el monto", "la cuenta") */
export function missingEntryFields(context: {
  validAmount: boolean
  accountRequired: boolean
  accountId: string
  linkId: string
}) {
  const { validAmount, accountRequired, accountId, linkId } = context
  return [
    !validAmount && "el monto",
    accountRequired && !accountId && !linkId && "la cuenta"
  ].filter((field): field is string => typeof field === "string")
}

/**
 * Lo que se toma de un movimiento ya registrado al enlazarlo: cuenta, fecha,
 * hora y textos. En un pago de tarjeta el gasto se borra: su descripción pasa
 * a la nota
 */
export function adoptLinkable(
  candidate: LinkableTransaction,
  isCardPayment: boolean
) {
  const base = {
    accountId: candidate.account_id ?? "",
    occurredOn: candidate.occurred_on,
    time: candidate.occurred_time?.slice(0, 5) ?? ""
  }
  if (isCardPayment) {
    return { ...base, note: candidate.note ?? candidate.description }
  }
  return {
    ...base,
    description: candidate.description,
    ...(candidate.note ? { note: candidate.note } : {})
  }
}

/** Placeholder de la descripción del movimiento: "Pago Visa", "Abono Ana"… */
export function entryDescriptionPlaceholder(
  type: EntryType,
  isReceivable: boolean,
  debtName: string
) {
  const verb =
    type === "advance"
      ? "Avance"
      : isReceivable || type === "extra"
        ? "Abono"
        : "Pago"
  return `${verb} ${debtName}`
}

/** Placeholder de la categoría: la que se asigna si no se elige otra */
export function entryCategoryPlaceholder(
  type: EntryType,
  isReceivable: boolean
) {
  if (type === "advance") return "Avance de tarjeta"
  return isReceivable ? "Cobros" : "Deudas"
}

/** Qué pasa con tus cuentas al guardar, según el tipo y la cuenta */
export function accountEffect({
  type,
  isCard,
  isReceivable,
  createsTransaction,
  accountName,
  linking
}: {
  type: EntryType
  isCard: boolean
  isReceivable: boolean
  createsTransaction: boolean
  accountName: string | null
  linking: boolean
}) {
  switch (type) {
    case "payment":
    case "extra": {
      const extra = type === "extra" ? " No cubre el pago del mes." : ""
      if (isCard) {
        if (linking) {
          return `La salida elegida se elimina: el pago a la tarjeta ya descuenta de la cuenta.${extra}`
        }
        return accountName
          ? `Sale de ${accountName} hacia la tarjeta. No cuenta como salida.${extra}`
          : `No toca tus cuentas: solo baja el saldo.${extra}`
      }
      if (!createsTransaction) {
        return `No queda como ${isReceivable ? "entrada" : "salida"} en Movimientos.${extra}`
      }
      if (linking) {
        return `Se enlaza a la ${isReceivable ? "entrada" : "salida"} elegida: no se crea otra.${extra}`
      }
      return accountName
        ? `${isReceivable ? "Entra a" : "Sale de"} ${accountName} como ${isReceivable ? "entrada" : "salida"}.${extra}`
        : "Elige la cuenta."
    }
    case "purchase":
      return "Una compra no toca tus cuentas: solo sube el saldo de la tarjeta."
    case "advance":
      if (linking) return "Se enlaza a la entrada elegida: no se crea otra."
      return accountName
        ? `Entra a ${accountName} como entrada (Avance de tarjeta).`
        : "Elige la cuenta a la que entró el dinero."
    case "fee":
      return "La cuota de manejo no toca tus cuentas: la pagas con la tarjeta."
    case "adjustment":
      return "Un ajuste no toca tus cuentas."
  }
}
