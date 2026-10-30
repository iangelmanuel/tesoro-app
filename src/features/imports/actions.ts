"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import type { DuplicateCandidate } from "./duplicates"
import {
  type ConfirmImportInput,
  confirmImportSchema,
  duplicateRangeSchema
} from "./schemas"

const DEFAULT_ERROR = "No se pudo importar el archivo. Intenta de nuevo"
const INVALID_CATEGORY =
  "Una de las categorías elegidas no es válida. Revisa el mapeo de categorías"
const ARCHIVED_CATEGORY =
  "Una de las categorías elegidas está archivada. Elige otra"
const DUPLICATE_CATEGORY =
  "Ya existe una categoría con uno de los nombres nuevos. Mapéala a la existente"
const UNDO_NOT_FOUND = "No se encontró la importación"
const UNDO_ERROR = "No se pudo deshacer la importación. Intenta de nuevo"

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

export type DuplicateCandidatesResult =
  | { candidates: DuplicateCandidate[]; error?: undefined }
  | { error: string; candidates?: undefined }

export type ConfirmImportResult =
  | { importId: string; error?: undefined }
  | { error: string; importId?: undefined }

export type UndoImportResult =
  | { deleted: number; error?: undefined }
  | { error: string; deleted?: undefined }

// Movimientos del espacio Personal en el rango, para marcar duplicados
export async function getDuplicateCandidates(
  from: string,
  to: string
): Promise<DuplicateCandidatesResult> {
  const range = duplicateRangeSchema.safeParse({ from, to })

  if (!range.success) {
    return { error: "Rango de fechas inválido" }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("transactions_for_duplicates", {
    p_workspace_id: workspace.id,
    p_from: range.data.from,
    p_to: range.data.to
  })

  if (error) {
    return { error: "No se pudieron revisar los duplicados. Intenta de nuevo" }
  }

  return {
    candidates: data.map((row) => ({ ...row, amount: Number(row.amount) }))
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

// Borra los movimientos de la importación, también los editados después
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
    // no_data_found (P0002): ajena o inexistente; check_violation: ya deshecha
    if (error.code === "P0002") return { error: UNDO_NOT_FOUND }
    if (error.code === "23514") {
      return { error: "Esta importación ya se deshizo" }
    }
    return { error: UNDO_ERROR }
  }

  revalidatePersonalPages()
  return { deleted: data }
}
