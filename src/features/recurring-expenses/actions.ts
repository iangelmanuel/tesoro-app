"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { recurringExpenseSchema } from "./schemas"
import type {
  RecurringExpenseActionResult,
  RecurringExpenseFormState
} from "./types"

const NOT_FOUND = "No se encontró el gasto fijo"
const DEFAULT_ERROR = "No se pudo guardar el gasto fijo. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de gasto"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"

const FIELDS = [
  "name",
  "amount",
  "category_id",
  "frequency",
  "day_of_month",
  "month_of_year",
  "starts_on",
  "ends_on"
] as const

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, RecurringExpenseFormState> = {
  // check_expense_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este gasto fijo" }
}

function readValues(formData: FormData) {
  return Object.fromEntries(
    FIELDS.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<(typeof FIELDS)[number], string>
}

function toFormError(
  error: PostgrestError,
  values: Record<string, string>
): RecurringExpenseFormState {
  return {
    ...(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR }),
    values
  }
}

function parseForm(formData: FormData) {
  const values = readValues(formData)
  const parsed = recurringExpenseSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

// La categoría debe existir, ser visible para el usuario (RLS), ser de gasto
// y estar activa
async function validateCategory(categoryId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("categories")
    .select("type, archived_at")
    .eq("id", categoryId)
    .maybeSingle()

  if (!data || data.type !== "expense") {
    return INVALID_CATEGORY
  }
  if (data.archived_at !== null) {
    return ARCHIVED_CATEGORY
  }
  return null
}

export async function createRecurringExpense(
  _prevState: RecurringExpenseFormState,
  formData: FormData
): Promise<RecurringExpenseFormState> {
  const { values, parsed } = parseForm(formData)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const categoryError = await validateCategory(parsed.data.category_id)
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("recurring_expenses")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return toFormError(error, values)
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateRecurringExpense(
  _prevState: RecurringExpenseFormState,
  formData: FormData
): Promise<RecurringExpenseFormState> {
  const { values, parsed } = parseForm(formData)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const categoryError = await validateCategory(parsed.data.category_id)
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return toFormError(error, values)
  }
  if (data.length === 0) {
    return { error: NOT_FOUND, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Pausar (active = false) o reanudar (active = true)
export async function toggleRecurringExpense(
  id: string,
  active: boolean
): Promise<RecurringExpenseActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .update({ is_active: active === true })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo actualizar el gasto fijo. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}

// Los movimientos de pago se conservan: la FK los deja con el enlace en null
export async function deleteRecurringExpense(
  id: string
): Promise<RecurringExpenseActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el gasto fijo. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}
