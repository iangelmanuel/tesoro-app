import { entryTypeOf } from "@/features/debts/entry-types"
import type { DebtEntry } from "@/features/debts/queries"
import { type RefOption, resolveAccount } from "./references"

// Valores de los formularios de deuda que arman las tools de movimientos de
// deuda (SPEC 43) a partir de sus argumentos. Lógica pura: los esquemas de la
// UI validan después.

/**
 * Cuenta del pago: la que llega (id, null o nombre) o la habitual de la
 * deuda si sigue activa. Sin ninguna se pregunta (con una sola cuenta activa
 * se usa esa).
 */
export function paymentAccount(
  accounts: RefOption[],
  {
    id,
    name,
    habitual,
    label
  }: {
    id: string | null | undefined
    name: string | undefined
    habitual: string | null
    label: string
  }
) {
  if (
    id === undefined &&
    name === undefined &&
    habitual &&
    accounts.some((account) => account.id === habitual)
  ) {
    return { value: habitual }
  }
  return resolveAccount(accounts, {
    id,
    name,
    field: "account_id",
    label,
    nullable: true
  })
}

/** Cambios de update_debt_entry; lo que no llega queda como está */
export interface DebtEntryEdit {
  type?: string
  amount?: number
  direction?: string
  occurred_on?: string
  time?: string | null
  note?: string | null
  create_transaction?: boolean
  description?: string
  category_id?: string
  installments?: number | null
  link_transaction_id?: string
}

/**
 * Valores del editor de movimientos de deuda: lo guardado con los cambios
 * encima, como los prellena la app
 */
export function debtEntryEditValues(
  current: DebtEntry,
  args: DebtEntryEdit,
  accountId: string | null
) {
  const time =
    args.time === undefined
      ? (current.occurred_time?.slice(0, 5) ?? "")
      : (args.time ?? "")
  const installments =
    args.installments === undefined ? current.installments : args.installments
  return {
    type: args.type ?? entryTypeOf(current),
    amount: args.amount ?? Math.abs(current.amount),
    direction:
      args.direction ??
      (current.kind === "adjustment"
        ? current.amount < 0
          ? "down"
          : "up"
        : ""),
    occurred_on: args.occurred_on ?? current.occurred_on,
    occurred_time: time,
    note: (args.note === undefined ? current.note : args.note) ?? "",
    account_id: accountId ?? "",
    create_transaction:
      args.create_transaction ??
      (current.kind !== "payment" || current.transaction_id !== null),
    description: args.description ?? current.description ?? "",
    category_id: args.category_id ?? current.category_id ?? "",
    installments: installments ?? "",
    link_transaction_id: args.link_transaction_id ?? ""
  }
}
