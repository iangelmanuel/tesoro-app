"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import type { DuplicateCandidate } from "./duplicates"
import {
  type ConfirmDebtEntriesImportInput,
  type ConfirmGoalContributionsImportInput,
  type ConfirmImportInput,
  type ConfirmRecurringImportInput,
  confirmDebtEntriesImportSchema,
  confirmGoalContributionsImportSchema,
  confirmImportSchema,
  confirmRecurringImportSchema,
  duplicateRangeSchema,
  linkDuplicatesSchema
} from "./schemas"
import type { DebtEntryKind } from "./types"

const DEFAULT_ERROR = "No se pudo importar el archivo. Intenta de nuevo"
const INVALID_CATEGORY =
  "Una de las categorías elegidas no es válida. Revisa el mapeo de categorías"
const ARCHIVED_CATEGORY =
  "Una de las categorías elegidas está archivada. Elige otra"
const DUPLICATE_CATEGORY =
  "Ya existe una categoría con uno de los nombres nuevos. Mapéala a la existente"
const UNDO_NOT_FOUND = "No se encontró la importación"
const UNDO_ERROR = "No se pudo deshacer la importación. Intenta de nuevo"
const DUPLICATES_ERROR =
  "No se pudieron revisar los duplicados. Intenta de nuevo"
const INACTIVE_DEBT =
  "Una de las deudas elegidas ya no está activa. Revisa el mapeo de deudas"
const INACTIVE_GOAL =
  "Una de las metas elegidas ya no está activa. Revisa el mapeo de metas"

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, string> = {
  // check_transaction_category y los check de la tabla
  "23514": INVALID_CATEGORY,
  // FK de category_id
  "23503": INVALID_CATEGORY,
  // Índice único de categories (nombre por espacio y tipo)
  "23505": DUPLICATE_CATEGORY,
  // Verificación de dueño de la RPC
  "42501": "No tienes permiso para importar en este espacio"
}

// Mensajes de las RPC y de los triggers de deudas y metas (SPEC 05, 06 y
// 08b) que se muestran tal cual
const RPC_MESSAGES = new Set([
  "La deuda no existe",
  "La meta no existe",
  "Reactiva la deuda para registrar pagos",
  "Reactiva la meta para registrar aportes",
  "La fecha no puede ser futura",
  "La fecha del aporte no puede ser futura",
  "El saldo de la deuda no puede quedar negativo",
  "No puedes retirar más de lo ahorrado",
  "Máximo 2.000 filas por importación"
])

export type DuplicateRequest =
  | { target: "transactions"; from: string; to: string }
  | { target: "recurring_expenses" }
  | {
      target: "debt_entries" | "goal_contributions"
      from: string
      to: string
      /** Deudas o metas de las filas */
      ids: string[]
    }

export type DuplicateCandidates =
  | { target: "transactions"; candidates: DuplicateCandidate[] }
  | { target: "recurring_expenses"; candidates: { name: string }[] }
  | {
      target: "debt_entries"
      candidates: {
        debtId: string
        kind: DebtEntryKind
        amount: number
        occurred_on: string
      }[]
    }
  | {
      target: "goal_contributions"
      candidates: { goalId: string; amount: number; occurred_on: string }[]
    }

export type DuplicateCandidatesResult =
  | (DuplicateCandidates & { error?: undefined })
  | { error: string; target?: undefined; candidates?: undefined }

export type ConfirmImportResult =
  | { importId: string; error?: undefined }
  | { error: string; importId?: undefined }

export type UndoImportResult =
  | { deleted: number; error?: undefined }
  | { error: string; deleted?: undefined }

// Filas existentes del destino para marcar duplicados. Respetan RLS: solo
// llegan las del espacio del usuario.
export async function getDuplicateCandidates(
  request: DuplicateRequest
): Promise<DuplicateCandidatesResult> {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()

  if (request.target === "recurring_expenses") {
    // Todos los gastos fijos del espacio, activos o no
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("name")
      .eq("workspace_id", workspace.id)

    if (error) return { error: DUPLICATES_ERROR }
    return { target: request.target, candidates: data }
  }

  if (request.target === "transactions") {
    const range = duplicateRangeSchema.safeParse(request)
    if (!range.success) return { error: "Rango de fechas inválido" }

    const { data, error } = await supabase.rpc("transactions_for_duplicates", {
      p_workspace_id: workspace.id,
      p_from: range.data.from,
      p_to: range.data.to
    })

    if (error) return { error: DUPLICATES_ERROR }
    return {
      target: request.target,
      candidates: data.map((row) => ({ ...row, amount: Number(row.amount) }))
    }
  }

  const parsed = linkDuplicatesSchema.safeParse({
    ...request,
    ids: [...new Set(request.ids)]
  })
  if (!parsed.success || parsed.data.from > parsed.data.to) {
    return { error: "Rango de fechas inválido" }
  }
  const { from, to, ids } = parsed.data

  if (request.target === "debt_entries") {
    const { data, error } = await supabase
      .from("debt_entries")
      .select("debt_id, kind, amount, occurred_on")
      .eq("workspace_id", workspace.id)
      .in("debt_id", ids)
      .gte("occurred_on", from)
      .lte("occurred_on", to)

    if (error) return { error: DUPLICATES_ERROR }
    return {
      target: request.target,
      candidates: data.map((row) => ({
        debtId: row.debt_id,
        kind: row.kind,
        amount: Number(row.amount),
        occurred_on: row.occurred_on
      }))
    }
  }

  const { data, error } = await supabase
    .from("goal_contributions")
    .select("goal_id, amount, occurred_on")
    .eq("workspace_id", workspace.id)
    .in("goal_id", ids)
    .gte("occurred_on", from)
    .lte("occurred_on", to)

  if (error) return { error: DUPLICATES_ERROR }
  return {
    target: request.target,
    candidates: data.map((row) => ({
      goalId: row.goal_id,
      amount: Number(row.amount),
      occurred_on: row.occurred_on
    }))
  }
}

// Las categorías existentes deben ser visibles para el usuario (RLS), tener
// el tipo del movimiento y estar activas. El trigger de transactions también
// verifica tipo y espacio; esto da un mensaje claro antes de la RPC.
async function validateCategories(
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

  const supabase = await createClient()
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

// Las deudas o metas deben ser visibles para el usuario (RLS) y estar
// activas. Los triggers también lo verifican; esto da un mensaje claro.
async function validateLinks(
  table: "debts" | "savings_goals",
  ids: string[]
): Promise<string | null> {
  const unique = [...new Set(ids)]
  const inactive = table === "debts" ? INACTIVE_DEBT : INACTIVE_GOAL

  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select("id, status")
    .in("id", unique)

  if (error) return DEFAULT_ERROR
  if (data.length !== unique.length) return inactive
  return data.every((item) => item.status === "active") ? null : inactive
}

// Error de una RPC de importación como mensaje para el usuario
function rpcErrorMessage(error: { code: string; message: string }) {
  if (RPC_MESSAGES.has(error.message)) return error.message
  return PG_ERROR_MESSAGES[error.code] ?? DEFAULT_ERROR
}

// Revalida las filas mapeadas y las guarda todo o nada con import_transactions
export async function confirmImport(
  input: ConfirmImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const { filename, sheets, stats, newCategories, rows } = parsed.data

  const categoryError = await validateCategories(rows)
  if (categoryError) {
    return { error: categoryError }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_transactions", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_new_categories: newCategories,
    p_rows: rows
  })

  if (error) {
    return { error: PG_ERROR_MESSAGES[error.code] ?? DEFAULT_ERROR }
  }

  revalidatePersonalPages()
  return { importId: data }
}

// Gastos fijos: revalida y guarda todo o nada con import_recurring_expenses
export async function confirmRecurringImport(
  input: ConfirmRecurringImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmRecurringImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const { filename, sheets, stats, newCategories, rows } = parsed.data

  const categoryError = await validateCategories(
    rows.map((row) => ({ type: "expense", category_id: row.category_id }))
  )
  if (categoryError) {
    return { error: categoryError }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_recurring_expenses", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_new_categories: newCategories,
    p_rows: rows
  })

  if (error) {
    return { error: rpcErrorMessage(error) }
  }

  revalidatePersonalPages()
  return { importId: data }
}

// Deudas: revalida y guarda todo o nada con import_debt_entries
export async function confirmDebtEntriesImport(
  input: ConfirmDebtEntriesImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmDebtEntriesImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const { filename, sheets, stats, createTransactions, rows } = parsed.data

  const linkError = await validateLinks(
    "debts",
    rows.map((row) => row.debt_id)
  )
  if (linkError) {
    return { error: linkError }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_debt_entries", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_create_transactions: createTransactions,
    p_rows: rows
  })

  if (error) {
    return { error: rpcErrorMessage(error) }
  }

  revalidatePersonalPages()
  return { importId: data }
}

// Metas: revalida y guarda todo o nada con import_goal_contributions
export async function confirmGoalContributionsImport(
  input: ConfirmGoalContributionsImportInput
): Promise<ConfirmImportResult> {
  const parsed = confirmGoalContributionsImportSchema.safeParse(input)

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? DEFAULT_ERROR }
  }

  const { filename, sheets, stats, rows } = parsed.data

  const linkError = await validateLinks(
    "savings_goals",
    rows.map((row) => row.goal_id)
  )
  if (linkError) {
    return { error: linkError }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("import_goal_contributions", {
    p_workspace_id: workspace.id,
    p_filename: filename,
    p_sheets: sheets,
    p_stats: stats,
    p_rows: rows
  })

  if (error) {
    return { error: rpcErrorMessage(error) }
  }

  revalidatePersonalPages()
  return { importId: data }
}

// Borra las filas de la importación según su destino, también las editadas
// después. Si una deuda o meta lo impide, el mensaje la nombra.
export async function undoImport(importId: string): Promise<UndoImportResult> {
  const parsedId = idSchema.safeParse(importId)

  if (!parsedId.success) {
    return { error: UNDO_NOT_FOUND }
  }

  // Valida la sesión antes de llamar la RPC (redirige si no hay)
  await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("undo_import", {
    p_import_id: parsedId.data
  })

  if (error) {
    // no_data_found (P0002): ajena o inexistente
    if (error.code === "P0002") return { error: UNDO_NOT_FOUND }
    if (error.message === "La importación ya se deshizo") {
      return { error: "Esta importación ya se deshizo" }
    }
    // undo_import nombra la deuda o meta que impide deshacer
    if (error.code === "23514" && error.message.includes("«")) {
      return { error: error.message }
    }
    if (RPC_MESSAGES.has(error.message)) return { error: error.message }
    return { error: UNDO_ERROR }
  }

  revalidatePersonalPages()
  return { deleted: data }
}
