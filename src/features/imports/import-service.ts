import "server-only"
import type { z } from "zod"
import type { AppSupabase } from "@/libs/supabase/types"
import {
  ARCHIVED_CATEGORY,
  DEFAULT_ERROR,
  INACTIVE_DEBT,
  INACTIVE_GOAL,
  INVALID_ACCOUNT,
  INVALID_CATEGORY,
  rpcErrorMessage,
  transactionImportErrorMessage,
  undoErrorMessage
} from "./import-errors"
import type {
  confirmDebtEntriesImportSchema,
  confirmGoalContributionsImportSchema,
  confirmImportSchema,
  confirmRecurringImportSchema
} from "./schemas"
import type { ConfirmImportResult, UndoImportResult } from "./types"

// Escrituras de la importación (SPEC 08 y 08b): revalidan las filas ya
// validadas con Zod contra la BD y las guardan todo o nada con la RPC del
// destino. Con la sesión del usuario: RLS decide qué se puede.

/**
 * Espacio de destino (el Personal del usuario). Se resuelve después de
 * revalidar las filas, como lo hacían las actions
 */
type ResolveWorkspace = () => Promise<{ id: string }>

// Las categorías existentes deben ser visibles para el usuario (RLS), tener
// el tipo del movimiento y estar activas. El trigger de transactions también
// verifica tipo y espacio; esto da un mensaje claro antes de la RPC.
async function validateCategories(
  supabase: AppSupabase,
  rows: { type: string; category_id: string | null }[]
): Promise<string | null> {
  const expected = new Map<string, string>()

  for (const row of rows) {
    if (row.category_id === null) continue
    const type = expected.get(row.category_id)
    if (type && type !== row.type) return INVALID_CATEGORY
    expected.set(row.category_id, row.type)
  }

  if (expected.size === 0) return null

  const { data, error } = await supabase
    .from("categories")
    .select("id, type, archived_at")
    .in("id", [...expected.keys()])

  if (error) return DEFAULT_ERROR
  if (data.length !== expected.size) return INVALID_CATEGORY

  for (const category of data) {
    if (category.type !== expected.get(category.id)) return INVALID_CATEGORY
    if (category.archived_at !== null) return ARCHIVED_CATEGORY
  }

  return null
}

// Las cuentas existentes deben ser visibles para el usuario (RLS) y estar
// activas. check_account_active y la FK compuesta también lo verifican.
async function validateAccounts(
  supabase: AppSupabase,
  rows: { account_id: string | null }[]
): Promise<string | null> {
  const ids = [
    ...new Set(rows.flatMap((row) => (row.account_id ? [row.account_id] : [])))
  ]
  if (ids.length === 0) return null

  const { data, error } = await supabase
    .from("accounts")
    .select("id, archived_at")
    .in("id", ids)

  if (error) return DEFAULT_ERROR
  if (data.length !== ids.length) return INVALID_ACCOUNT
  return data.every((account) => account.archived_at === null)
    ? null
    : INVALID_ACCOUNT
}

// Las deudas o metas deben ser visibles para el usuario (RLS) y estar
// activas. Los triggers también lo verifican; esto da un mensaje claro.
async function validateLinks(
  supabase: AppSupabase,
  table: "debts" | "savings_goals",
  ids: string[]
): Promise<string | null> {
  const unique = [...new Set(ids)]
  const inactive = table === "debts" ? INACTIVE_DEBT : INACTIVE_GOAL

  const { data, error } = await supabase
    .from(table)
    .select("id, status")
    .in("id", unique)

  if (error) return DEFAULT_ERROR
  if (data.length !== unique.length) return inactive
  return data.every((item) => item.status === "active") ? null : inactive
}

/** Movimientos: revalida categorías y cuentas y guarda con import_transactions */
export async function importTransactionsRecord(
  supabase: AppSupabase,
  resolveWorkspace: ResolveWorkspace,
  data: z.output<typeof confirmImportSchema>
): Promise<ConfirmImportResult> {
  const { filename, sheets, stats, newCategories, newAccounts, rows } = data

  const categoryError =
    (await validateCategories(supabase, rows)) ??
    (await validateAccounts(supabase, rows))
  if (categoryError) {
    return { error: categoryError }
  }

  const workspace = await resolveWorkspace()
  const result = await supabase.rpc("import_transactions", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_new_categories: newCategories,
    p_new_accounts: newAccounts,
    p_rows: rows
  })

  if (result.error) {
    return { error: transactionImportErrorMessage(result.error) }
  }
  return { importId: result.data }
}

/** Gastos fijos: revalida categorías y guarda con import_recurring_expenses */
export async function importRecurringRecord(
  supabase: AppSupabase,
  resolveWorkspace: ResolveWorkspace,
  data: z.output<typeof confirmRecurringImportSchema>
): Promise<ConfirmImportResult> {
  const { filename, sheets, stats, newCategories, rows } = data

  const categoryError = await validateCategories(
    supabase,
    rows.map((row) => ({ type: "expense", category_id: row.category_id }))
  )
  if (categoryError) {
    return { error: categoryError }
  }

  const workspace = await resolveWorkspace()
  const result = await supabase.rpc("import_recurring_expenses", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_new_categories: newCategories,
    p_rows: rows
  })

  if (result.error) {
    return { error: rpcErrorMessage(result.error) }
  }
  return { importId: result.data }
}

/** Deudas: revalida las deudas y guarda con import_debt_entries */
export async function importDebtEntriesRecord(
  supabase: AppSupabase,
  resolveWorkspace: ResolveWorkspace,
  data: z.output<typeof confirmDebtEntriesImportSchema>
): Promise<ConfirmImportResult> {
  const { filename, sheets, stats, createTransactions, rows } = data

  const linkError = await validateLinks(
    supabase,
    "debts",
    rows.map((row) => row.debt_id)
  )
  if (linkError) {
    return { error: linkError }
  }

  const workspace = await resolveWorkspace()
  const result = await supabase.rpc("import_debt_entries", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_create_transactions: createTransactions,
    p_rows: rows
  })

  if (result.error) {
    return { error: rpcErrorMessage(result.error) }
  }
  return { importId: result.data }
}

/** Metas: revalida las metas y guarda con import_goal_contributions */
export async function importGoalContributionsRecord(
  supabase: AppSupabase,
  resolveWorkspace: ResolveWorkspace,
  data: z.output<typeof confirmGoalContributionsImportSchema>
): Promise<ConfirmImportResult> {
  const { filename, sheets, stats, rows } = data

  const linkError = await validateLinks(
    supabase,
    "savings_goals",
    rows.map((row) => row.goal_id)
  )
  if (linkError) {
    return { error: linkError }
  }

  const workspace = await resolveWorkspace()
  const result = await supabase.rpc("import_goal_contributions", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_rows: rows
  })

  if (result.error) {
    return { error: rpcErrorMessage(result.error) }
  }
  return { importId: result.data }
}

/**
 * Borra las filas de la importación según su destino, también las editadas
 * después. Si una deuda o meta lo impide, el mensaje la nombra.
 */
export async function undoImportRecord(
  supabase: AppSupabase,
  importId: string
): Promise<UndoImportResult> {
  const { data, error } = await supabase.rpc("undo_import", {
    p_import_id: importId
  })

  if (error) {
    return { error: undoErrorMessage(error) }
  }
  return { deleted: data }
}
