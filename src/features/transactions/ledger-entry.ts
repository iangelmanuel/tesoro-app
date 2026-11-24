import type { IncomeAllocation } from "@/features/recurring-incomes/types"
import type { Database } from "@/types/database"
import { ACCOUNT_MOVEMENT_KINDS } from "./constants"
import type { TransactionType } from "./filters"
import type {
  AccountMovementKind,
  LedgerEntry,
  LedgerOrder,
  LinkedDebtEntry
} from "./types"

// Convierte una fila de la vista ledger_entries en la fila de Movimientos.
// Puro: los enlaces y los padres los pide getTransactions (queries.ts).

type LedgerEntryRow = Database["public"]["Views"]["ledger_entries"]["Row"]

/** Enlaces de un movimiento que la vista ledger_entries no trae */
export interface TransactionLinks {
  recurringExpenseId: string | null
  recurringIncomeId: string | null
  recurringIncomeAllocations: IncomeAllocation[]
  debtEntry: LinkedDebtEntry | null
}

/**
 * Deuda o meta de un pago, avance o aporte, si el pago es un abono extra y si
 * el padre sigue activo
 */
export interface ParentLink {
  parentId: string
  isExtraPayment: boolean
  isActive: boolean
}

/** El `kind` de la vista es un pago, avance o aporte con cuenta */
export function isAccountMovementKind(
  kind: string | null
): kind is AccountMovementKind {
  return ACCOUNT_MOVEMENT_KINDS.some((value) => value === kind)
}

/**
 * Fila de Movimientos a partir de una fila de ledger_entries. Las columnas de
 * una vista llegan como nullable en los tipos generados.
 */
export function toLedgerEntry(
  row: LedgerEntryRow,
  links: Map<string, TransactionLinks>,
  parents: Map<string, ParentLink>
): LedgerEntry {
  const id = row.id as string
  const amount = Number(row.amount)
  const occurred_on = row.occurred_on as string
  const order: LedgerOrder = {
    occurred_time: row.occurred_time,
    day_position: row.day_position as number
  }

  if (row.kind === "transfer") {
    return {
      ...order,
      kind: "transfer",
      id,
      amount,
      occurred_on,
      note: row.note,
      from_account_id: row.account_id as string,
      to_account_id: row.to_account_id as string
    }
  }
  if (row.kind === "adjustment") {
    return {
      ...order,
      kind: "adjustment",
      id,
      amount,
      occurred_on,
      note: row.note,
      account_id: row.account_id as string
    }
  }

  if (isAccountMovementKind(row.kind)) {
    return {
      ...order,
      kind: row.kind,
      id,
      amount,
      occurred_on,
      note: row.note,
      account_id: row.account_id as string,
      name: row.description ?? "",
      parent_id: parents.get(id)?.parentId ?? "",
      is_extra_payment: parents.get(id)?.isExtraPayment ?? false,
      parent_active: parents.get(id)?.isActive ?? false
    }
  }

  const type = row.kind as TransactionType
  const link = links.get(id)
  return {
    ...order,
    kind: type,
    debt_entry: link?.debtEntry ?? null,
    transaction: {
      id,
      type,
      amount,
      occurred_on,
      occurred_time: row.occurred_time,
      category_id: row.category_id as string,
      description: row.description as string,
      note: row.note,
      account_id: row.account_id,
      counterparty: row.counterparty,
      invoice_ref: row.invoice_ref,
      recurring_expense_id: link?.recurringExpenseId ?? null,
      recurring_income_id: link?.recurringIncomeId ?? null,
      recurring_income_allocations: link?.recurringIncomeAllocations ?? []
    }
  }
}
