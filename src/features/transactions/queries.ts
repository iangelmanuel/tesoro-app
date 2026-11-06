import { NO_ACCOUNT } from "@/features/accounts/constants"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import type { DebtEntry } from "@/features/debts/queries"
import type { DebtKind } from "@/features/debts/schemas"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import {
  PAGE_SIZE,
  type TransactionFilters,
  type TransactionType,
  escapeLikePattern,
  filtersDateRange
} from "./filters"

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]
type LedgerEntryRow = Database["public"]["Views"]["ledger_entries"]["Row"]

export type TransactionWithCategory = TransactionRow & {
  category: Pick<CategoryRow, "id" | "name" | "icon" | "color" | "archived_at">
}

/** Campos de un movimiento que usa el diálogo de edición */
export type EditableTransaction = Pick<
  TransactionRow,
  | "id"
  | "type"
  | "amount"
  | "occurred_on"
  | "occurred_time"
  | "category_id"
  | "description"
  | "note"
  | "account_id"
  | "counterparty"
  | "invoice_ref"
  | "recurring_expense_id"
  | "recurring_income_id"
  | "recurring_income_due_on"
>

/**
 * Abono enlazado a un movimiento: pago de préstamo o cobro de una cuenta por
 * cobrar (SPEC 26). Es la fuente de verdad: el movimiento se edita y elimina
 * desde el diálogo del pago. Trae lo que ese diálogo prellena (la nota del
 * abono no se sincroniza con la del movimiento).
 */
export type LinkedDebtEntry = Pick<
  DebtEntry,
  | "id"
  | "debt_id"
  | "workspace_id"
  | "kind"
  | "amount"
  | "occurred_on"
  | "occurred_time"
  | "note"
  | "transaction_id"
  | "is_extra_payment"
> & {
  debt_kind: DebtKind
}

/** Hora y posición manual dentro del día, comunes a toda fila de Movimientos */
interface LedgerOrder {
  /** "HH:MM:SS" desde Postgres; null si el usuario no la puso */
  occurred_time: string | null
  /** 0 = fila nueva (arriba del día); 1..n tras reordenar. No se edita */
  day_position: number
}

/**
 * Fila de Movimientos: un ingreso o gasto, un traspaso o un ajuste de saldo.
 * La categoría y la cuenta se resuelven en la tabla con las listas que la
 * página ya carga.
 */
export type LedgerEntry = LedgerOrder &
  (
    | {
        kind: TransactionType
        transaction: EditableTransaction
        /** Abono enlazado, si el movimiento es un pago de deuda */
        debt_entry: LinkedDebtEntry | null
      }
    | {
        kind: "transfer"
        id: string
        amount: number
        occurred_on: string
        note: string | null
        from_account_id: string
        to_account_id: string
      }
    | {
        kind: "adjustment"
        id: string
        /** > 0 sube el saldo */
        amount: number
        occurred_on: string
        note: string | null
        account_id: string
      }
    | {
        kind: AccountMovementKind
        id: string
        /** En un aporte de meta, < 0 es un retiro */
        amount: number
        occurred_on: string
        note: string | null
        account_id: string
        /** Nombre de la deuda o la meta */
        name: string
        /** Deuda o meta de origen; el diálogo de edición la necesita */
        parent_id: string
        /** Pago de tarjeta que es un abono extra (no cubre el mínimo) */
        is_extra_payment: boolean
      }
  )

/**
 * Pagos y avances de tarjeta y aportes de metas que llevan cuenta (SPEC 16).
 * Mueven capital, no son ingreso ni gasto: quedan fuera de los totales. Se
 * editan con el diálogo de la deuda o la meta (SPEC 26).
 */
export const ACCOUNT_MOVEMENT_KINDS = [
  "debt_payment",
  "debt_advance",
  "goal_contribution"
] as const

export type AccountMovementKind = (typeof ACCOUNT_MOVEMENT_KINDS)[number]

export interface TransactionTotals {
  income: number
  expense: number
  balance: number
}

// Valor entre comillas para un filtro `or` de PostgREST: escapa `\` y `"`
function quotePostgrestValue(value: string) {
  return `"${value.replace(/[\\"]/g, (match) => `\\${match}`)}"`
}

// PostgREST responde PGRST103 si la página pide un offset mayor que el total
const RANGE_NOT_SATISFIABLE = "PGRST103"

// Lee la vista ledger_entries para paginar movimientos, traspasos, ajustes y
// pagos con cuenta juntos, con el orden real (fecha, posición manual del día,
// captura). Los enlaces a un gasto fijo y a un abono no están en la vista:
// se piden aparte solo para los movimientos de la página.
export async function getTransactions(
  workspaceId: string,
  filters: TransactionFilters
): Promise<{ rows: LedgerEntry[]; count: number }> {
  const supabase = await createClient()
  const range = filtersDateRange(filters)
  const from = (filters.page - 1) * PAGE_SIZE

  function filtered(head: boolean) {
    let query = supabase
      .from("ledger_entries")
      .select("*", { count: "exact", head })
      .eq("workspace_id", workspaceId)

    if (range) {
      query = query.gte("occurred_on", range.from).lte("occurred_on", range.to)
    }
    if (filters.type === "transfer") {
      query = query.in("kind", [
        "transfer",
        "adjustment",
        ...ACCOUNT_MOVEMENT_KINDS
      ])
    } else if (filters.type) {
      query = query.eq("kind", filters.type)
    }
    // Traspasos y ajustes no tienen categoría: el filtro los excluye
    if (filters.categoryId) {
      query = query.eq("category_id", filters.categoryId)
    }
    if (filters.accountId === NO_ACCOUNT) {
      query = query.is("account_id", null).in("kind", [...TRANSACTION_TYPES])
    } else if (filters.accountId) {
      // Cuenta del movimiento o del ajuste, u origen o destino del traspaso
      query = query.or(
        `account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`
      )
    }
    if (filters.q) {
      const pattern = quotePostgrestValue(`%${escapeLikePattern(filters.q)}%`)
      // Contraparte y factura solo tienen valor en Empresa
      query = query.or(
        [
          `description.ilike.${pattern}`,
          `note.ilike.${pattern}`,
          `counterparty.ilike.${pattern}`,
          `invoice_ref.ilike.${pattern}`
        ].join(",")
      )
    }
    return query
  }

  const { data, count, error } = await filtered(false)
    .order("occurred_on", { ascending: false })
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  // Página fuera de rango: sin filas, pero con el total real para paginar
  if (error?.code === RANGE_NOT_SATISFIABLE) {
    const { count: total, error: countError } = await filtered(true)
    if (!countError) {
      return { rows: [], count: total ?? 0 }
    }
  }
  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }

  const idsOf = (kinds: readonly string[]) =>
    data
      .filter((row) => kinds.includes(row.kind as string))
      .map((row) => row.id as string)

  const [links, debtParents, goalParents] = await Promise.all([
    getTransactionLinks(idsOf(TRANSACTION_TYPES)),
    getParentIds("debt_entries", idsOf(["debt_payment", "debt_advance"])),
    getParentIds("goal_contributions", idsOf(["goal_contribution"]))
  ])
  const parents = new Map([...debtParents, ...goalParents])

  return {
    rows: data.map((row) => toLedgerEntry(row, links, parents)),
    count: count ?? 0
  }
}

/** Enlaces de un movimiento que la vista ledger_entries no trae */
interface TransactionLinks {
  recurringExpenseId: string | null
  recurringIncomeId: string | null
  recurringIncomeDueOn: string | null
  debtEntry: LinkedDebtEntry | null
}

// Gasto fijo y abono enlazados a los movimientos de la página
async function getTransactionLinks(ids: string[]) {
  const links = new Map<string, TransactionLinks>()
  if (ids.length === 0) {
    return links
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, recurring_expense_id, recurring_income_id, recurring_income_due_on, debt_entries(id, debt_id, workspace_id, kind, amount, occurred_on, occurred_time, note, transaction_id, is_extra_payment, debts(kind))"
    )
    .in("id", ids)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  for (const link of data) {
    // transaction_id es único: a lo sumo un abono por movimiento
    const entry = link.debt_entries
    links.set(link.id, {
      recurringExpenseId: link.recurring_expense_id,
      recurringIncomeId: link.recurring_income_id,
      recurringIncomeDueOn: link.recurring_income_due_on,
      debtEntry: entry
        ? {
            id: entry.id,
            debt_id: entry.debt_id,
            workspace_id: entry.workspace_id,
            kind: entry.kind,
            amount: Number(entry.amount),
            occurred_on: entry.occurred_on,
            occurred_time: entry.occurred_time,
            note: entry.note,
            transaction_id: entry.transaction_id,
            is_extra_payment: entry.is_extra_payment,
            debt_kind: entry.debts.kind
          }
        : null
    })
  }
  return links
}

/** Deuda o meta de un pago, avance o aporte, y si el pago es un abono extra */
interface ParentLink {
  parentId: string
  isExtraPayment: boolean
}

// Deuda o meta de los pagos, avances y aportes de la página: id → padre
async function getParentIds(
  table: "debt_entries" | "goal_contributions",
  ids: string[]
) {
  const parents = new Map<string, ParentLink>()
  if (ids.length === 0) {
    return parents
  }

  const supabase = await createClient()
  if (table === "debt_entries") {
    const { data, error } = await supabase
      .from("debt_entries")
      .select("id, parent_id:debt_id, is_extra_payment")
      .in("id", ids)

    if (error) {
      throw new Error("No se pudieron cargar los movimientos")
    }
    for (const row of data) {
      parents.set(row.id, {
        parentId: row.parent_id,
        isExtraPayment: row.is_extra_payment
      })
    }
    return parents
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("id, parent_id:goal_id")
    .in("id", ids)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  for (const row of data) {
    parents.set(row.id, { parentId: row.parent_id, isExtraPayment: false })
  }
  return parents
}

// Las columnas de una vista llegan como nullable en los tipos generados
function toLedgerEntry(
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
      is_extra_payment: parents.get(id)?.isExtraPayment ?? false
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
      recurring_income_due_on: link?.recurringIncomeDueOn ?? null
    }
  }
}

function isAccountMovementKind(
  kind: string | null
): kind is AccountMovementKind {
  return ACCOUNT_MOVEMENT_KINDS.some((value) => value === kind)
}

// Para distinguir "sin movimientos" de "sin resultados para los filtros"
export async function hasAnyTransactions(workspaceId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .limit(1)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  return (count ?? 0) > 0
}

// Igual que hasAnyTransactions, contando también traspasos y ajustes
export async function hasAnyLedgerEntries(workspaceId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .limit(1)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }
  return (count ?? 0) > 0
}

// Totales de todo el periodo filtrado, no solo de la página actual. Solo
// suman ingresos y gastos: traspasos y ajustes no cuentan.
export async function getTransactionTotals(
  workspaceId: string,
  filters: TransactionFilters
): Promise<TransactionTotals> {
  // El filtro "Traspasos" no muestra ingresos ni gastos
  if (filters.type === "transfer") {
    return { income: 0, expense: 0, balance: 0 }
  }

  const supabase = await createClient()
  const range = filtersDateRange(filters)
  const withoutAccount = filters.accountId === NO_ACCOUNT

  const { data, error } = await supabase
    .rpc("transaction_totals", {
      p_workspace_id: workspaceId,
      p_from: range?.from,
      p_to: range?.to,
      p_type: filters.type,
      p_category_id: filters.categoryId,
      p_search: filters.q,
      p_account_id: withoutAccount ? undefined : filters.accountId,
      p_without_account: withoutAccount
    })
    .single()

  if (error) {
    throw new Error("No se pudieron calcular los totales")
  }

  const income = Number(data.income)
  const expense = Number(data.expense)
  return { income, expense, balance: income - expense }
}

export const VERIFY_PAGE_SIZE = 50

/**
 * Fila de Verificar movimientos (SPEC 19): plana y de solo lectura. `kind` es
 * el de ledger_entries; en un aporte de meta, el signo del monto distingue
 * aporte y retiro.
 */
export interface VerifyEntry {
  key: string
  kind: string
  amount: number
  occurred_on: string
  occurred_time: string | null
  account_id: string | null
  to_account_id: string | null
  /** Descripción del movimiento o nombre de la deuda o la meta */
  title: string
  note: string | null
}

// Historial completo sin filtro de mes, de lo más reciente hacia atrás, con el
// mismo orden que la tabla de Movimientos. Pide una fila de más para saber si
// quedan páginas sin usar count exact.
export async function getVerifyEntries(
  workspaceId: string,
  options: { accountId?: string; offset: number }
): Promise<{ rows: VerifyEntry[]; hasMore: boolean }> {
  const supabase = await createClient()
  let query = supabase
    .from("ledger_entries")
    .select(
      "id, kind, amount, occurred_on, occurred_time, account_id, to_account_id, description, note"
    )
    .eq("workspace_id", workspaceId)

  if (options.accountId) {
    // Cuenta del movimiento o del ajuste, u origen o destino del traspaso
    query = query.or(
      `account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`
    )
  }

  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("day_position", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(options.offset, options.offset + VERIFY_PAGE_SIZE)

  if (error) {
    throw new Error("No se pudieron cargar los movimientos")
  }

  return {
    rows: data.slice(0, VERIFY_PAGE_SIZE).map((row) => ({
      key: `${row.kind}:${row.id}`,
      kind: row.kind as string,
      amount: Number(row.amount),
      occurred_on: row.occurred_on as string,
      occurred_time: row.occurred_time,
      account_id: row.account_id,
      to_account_id: row.to_account_id,
      title: row.description ?? "",
      note: row.note
    })),
    hasMore: data.length > VERIFY_PAGE_SIZE
  }
}
