/**
 * Textos y agrupación del historial de movimientos de una deuda
 * (DebtEntriesList y sus filas)
 */
import type { Debt, DebtEntry } from "./queries"

/**
 * Lo que el historial usa de la deuda. Día de pago, corte y próximo
 * vencimiento ubican la cuota en curso de una compra (SPEC 42)
 */
export type EntriesDebt = Pick<
  Debt,
  | "id"
  | "kind"
  | "balance"
  | "name"
  | "status"
  | "schedule"
  | "due_day"
  | "closing_day"
  | "next_due_on"
>

/** Movimientos agrupados por mes (YYYY-MM), conservando su orden */
export function groupByMonth(entries: DebtEntry[]) {
  const groups = new Map<string, DebtEntry[]>()
  for (const entry of entries) {
    const month = entry.occurred_on.slice(0, 7)
    const group = groups.get(month)
    if (group) {
      group.push(entry)
    } else {
      groups.set(month, [entry])
    }
  }
  return [...groups]
}

/** "A {cuenta}" o "Desde {cuenta}"; sin cuenta, "Fuera de cuentas" */
function accountPhrase(preposition: "A" | "Desde", name: string | null) {
  return name ? `${preposition} ${name}` : "Fuera de cuentas"
}

/** Tipo del movimiento de la deuda: Pago, Abono, Compra, Avance… */
export function entryLabel(debt: Pick<Debt, "kind">, entry: DebtEntry) {
  if (entry.kind === "fee") return "Cuota de manejo"
  if (entry.kind === "advance") {
    // Con cuenta es un avance; sin ella, una compra (SPEC 42)
    return entry.payment_account_id === null ? "Compra" : "Avance"
  }
  if (entry.kind === "payment") {
    return debt.kind === "receivable" || entry.is_extra_payment
      ? "Abono"
      : "Pago"
  }
  return "Ajuste"
}

/**
 * Cuenta de la fila: los ajustes y las compras no mueven cuentas; el avance y
 * el abono de una cuenta por cobrar entran a la cuenta y el resto sale de ella
 */
export function entryAccountText(debt: Pick<Debt, "kind">, entry: DebtEntry) {
  if (entry.kind === "advance") {
    return entry.payment_account_id === null
      ? null
      : accountPhrase("A", entry.account_name)
  }
  if (entry.kind === "payment") {
    return accountPhrase(
      debt.kind === "receivable" ? "A" : "Desde",
      entry.account_name
    )
  }
  return null
}

/** Un pago baja el saldo; un ajuste lo sube o lo baja según su signo */
export function lowersBalance(entry: DebtEntry) {
  return entry.kind === "payment" || entry.amount < 0
}

/** "Cuota de manejo" y "Compra" son femeninas: "eliminada" */
export function isFeminineEntry(entry: DebtEntry) {
  return (
    entry.kind === "fee" ||
    (entry.kind === "advance" && entry.payment_account_id === null)
  )
}
