import type { Database } from "@/types/database"
import { formatTime } from "../shared"

// Fila de movimiento tal como la ve el agente (SPEC 34), con su vínculo:
// pago de préstamo o cobro de Me deben (debt_entries), pago de un gasto fijo
// o ingreso fijo recibido.

type DebtKind = Database["public"]["Enums"]["debt_kind"]

export const LINK_KINDS = [
  "any",
  "none",
  "debt",
  "recurring_expense",
  "recurring_income",
  "receivable"
] as const

export type LinkFilter = (typeof LINK_KINDS)[number]

const BASE_COLUMNS =
  "id, type, amount, occurred_on, occurred_time, day_position, created_at, description, note, counterparty, invoice_ref, recurring_due_on, recurring_income_due_on, categories(id, name), accounts(id, name), recurring_expenses(id, name), recurring_incomes(id, name)"

/** Columnas del select; con un filtro por abono, el embed es !inner */
export function transactionColumns(innerDebt: boolean) {
  return innerDebt
    ? `${BASE_COLUMNS}, debt_entries!inner(id, kind, debts!inner(id, name, kind))`
    : `${BASE_COLUMNS}, debt_entries(id, kind, debts(id, name, kind))`
}

export interface RawTransaction {
  id: string
  type: Database["public"]["Enums"]["transaction_type"]
  amount: number
  occurred_on: string
  occurred_time: string | null
  day_position: number
  created_at: string
  description: string
  note: string | null
  counterparty: string | null
  invoice_ref: string | null
  recurring_due_on: string | null
  recurring_income_due_on: string | null
  categories: { id: string; name: string } | null
  accounts: { id: string; name: string } | null
  recurring_expenses: { id: string; name: string } | null
  recurring_incomes: { id: string; name: string } | null
  debt_entries: {
    id: string
    kind: Database["public"]["Enums"]["debt_entry_kind"]
    debts: { id: string; name: string; kind: DebtKind } | null
  } | null
}

function toLink(row: RawTransaction) {
  const entry = row.debt_entries
  if (entry?.debts) {
    return {
      kind: entry.debts.kind === "receivable" ? "receivable" : "debt",
      debt_id: entry.debts.id,
      debt_name: entry.debts.name,
      debt_kind: entry.debts.kind,
      entry_id: entry.id
    }
  }
  if (row.recurring_expenses) {
    return {
      kind: "recurring_expense",
      id: row.recurring_expenses.id,
      name: row.recurring_expenses.name,
      due_on: row.recurring_due_on
    }
  }
  if (row.recurring_incomes) {
    return {
      kind: "recurring_income",
      id: row.recurring_incomes.id,
      name: row.recurring_incomes.name,
      due_on: row.recurring_income_due_on
    }
  }
  return null
}

export function toApiTransaction(row: RawTransaction) {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    occurred_on: row.occurred_on,
    time: formatTime(row.occurred_time),
    description: row.description,
    note: row.note,
    category: row.categories,
    account: row.accounts,
    counterparty: row.counterparty,
    invoice_ref: row.invoice_ref,
    link: toLink(row)
  }
}
