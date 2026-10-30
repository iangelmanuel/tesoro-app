"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import {
  createTransactionSchema,
  parseAmount,
  transactionSchema
} from "./schemas"
import type { TransactionActionResult, TransactionFormState } from "./types"

const NOT_FOUND = "No se encontró el movimiento"
const DEFAULT_ERROR = "No se pudo guardar el movimiento. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría válida para este tipo"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const RECURRING_NOT_FOUND = "No se encontró el gasto fijo"
const ALREADY_PAID = "Este pago ya está registrado"
const RECURRING_MUST_BE_EXPENSE = "El pago de un gasto fijo debe ser un gasto"
const UNIQUE_VIOLATION = "23505"

const FIELDS = [
  "type",
  "amount",
  "occurred_on",
  "category_id",
  "description",
  "note",
  "recurring_expense_id",
  "recurring_due_on"
] as const

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, TransactionFormState> = {
  // check_transaction_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este movimiento" }
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
): TransactionFormState {
  // Índice único por ocurrencia: el pago ya existe (p. ej. doble clic)
  if (error.code === UNIQUE_VIOLATION) {
    return { error: ALREADY_PAID, values }
  }
  return {
    ...(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR }),
    values
  }
}

function parseForm<T>(
  formData: FormData,
  schema: z.ZodType<T, unknown>
): { values: Record<string, string>; parsed: z.ZodSafeParseResult<T> } {
  const values = readValues(formData)
  const parsed = schema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

function toValidationError(
  error: z.ZodError,
  values: Record<string, string>
): TransactionFormState {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return { error: formErrors[0], fieldErrors, values }
}

// El gasto fijo debe ser del workspace Personal del usuario y la ocurrencia
// no debe tener pago. El trigger y el índice único lo garantizan en la BD;
// esto da un mensaje claro antes de insertar.
async function validateRecurring(
  workspaceId: string,
  recurringExpenseId: string,
  dueOn: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data: expense } = await supabase
    .from("recurring_expenses")
    .select("id")
    .eq("id", recurringExpenseId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!expense) {
    return RECURRING_NOT_FOUND
  }

  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("recurring_expense_id", recurringExpenseId)
    .eq("recurring_due_on", dueOn)

  return (count ?? 0) > 0 ? ALREADY_PAID : null
}

// La categoría debe existir, ser visible para el usuario (RLS), tener el tipo
// del movimiento y estar activa. Una archivada solo se acepta si ya era la
// categoría actual del movimiento que se edita.
async function validateCategory(
  categoryId: string,
  type: string,
  currentCategoryId?: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("categories")
    .select("type, archived_at")
    .eq("id", categoryId)
    .maybeSingle()

  if (!data || data.type !== type) {
    return INVALID_CATEGORY
  }
  if (data.archived_at !== null && categoryId !== currentCategoryId) {
    return ARCHIVED_CATEGORY
  }
  return null
}

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const { values, parsed } = parseForm(formData, createTransactionSchema)

  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const { recurring_expense_id, recurring_due_on } = parsed.data
  if (recurring_expense_id !== null && parsed.data.type !== "expense") {
    return { error: RECURRING_MUST_BE_EXPENSE, values }
  }

  const categoryError = await validateCategory(
    parsed.data.category_id,
    parsed.data.type
  )
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  const workspace = await getPersonalWorkspace()

  if (recurring_expense_id !== null && recurring_due_on !== null) {
    const recurringError = await validateRecurring(
      workspace.id,
      recurring_expense_id,
      recurring_due_on
    )
    if (recurringError) {
      return { error: recurringError, values }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("transactions")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return toFormError(error, values)
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  // transactionSchema no incluye el enlace al gasto fijo: editar lo conserva
  const { values, parsed } = parseForm(formData, transactionSchema)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return toValidationError(parsed.error, values)
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data: current } = await supabase
    .from("transactions")
    .select("category_id, recurring_expense_id")
    .eq("id", id.data)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!current) {
    return { error: NOT_FOUND, values }
  }
  if (current.recurring_expense_id !== null && parsed.data.type !== "expense") {
    return { error: RECURRING_MUST_BE_EXPENSE, values }
  }

  const categoryError = await validateCategory(
    parsed.data.category_id,
    parsed.data.type,
    current.category_id
  )
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  const { data, error } = await supabase
    .from("transactions")
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

export async function deleteTransaction(
  id: string
): Promise<TransactionActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el movimiento. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}
