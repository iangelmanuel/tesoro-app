"use server"

import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import {
  type RecurringExpenseHistory,
  getRecurringExpenseHistory
} from "./queries"
import { recurringExpenseSchema } from "./schemas"
import {
  RECURRING_EXPENSE_NOT_FOUND,
  createRecurringExpenseRecord,
  updateRecurringExpenseRecord
} from "./service"
import type {
  RecurringExpenseActionResult,
  RecurringExpenseFormState
} from "./types"

const NOT_FOUND = RECURRING_EXPENSE_NOT_FOUND

const FIELDS = [
  "name",
  "amount",
  "category_id",
  "account_id",
  "frequency",
  "day_of_month",
  "month_of_year",
  "starts_on",
  "ends_on"
] as const

const idSchema = z.uuid()

function readValues(formData: FormData) {
  return Object.fromEntries(
    FIELDS.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<(typeof FIELDS)[number], string>
}

function parseForm(formData: FormData) {
  const values = readValues(formData)
  const parsed = recurringExpenseSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

export async function createRecurringExpense(
  _prevState: RecurringExpenseFormState,
  formData: FormData
): Promise<RecurringExpenseFormState> {
  const { values, parsed } = parseForm(formData)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const result = await createRecurringExpenseRecord(
    await createClient(),
    workspace,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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

  const workspace = await getPersonalWorkspace()
  const result = await updateRecurringExpenseRecord(
    await createClient(),
    workspace,
    id.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
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

/** Tope de periodos del historial: 50 años de un gasto mensual */
const MAX_HISTORY_LIMIT = 600

export type RecurringExpenseHistoryResult =
  | { data: RecurringExpenseHistory; error?: undefined }
  | { data?: undefined; error: string }

// Lectura para el Sheet de un gasto fijo: se pide al abrirlo, con "Ver más"
// y tras registrar un pago desde él. RLS limita a los gastos del usuario.
export async function loadRecurringExpenseHistory(
  id: string,
  limit: number
): Promise<RecurringExpenseHistoryResult> {
  const parsedId = idSchema.safeParse(id)
  const parsedLimit = z.int().min(1).max(MAX_HISTORY_LIMIT).safeParse(limit)

  if (!parsedId.success || !parsedLimit.success) {
    return { error: NOT_FOUND }
  }

  try {
    const data = await getRecurringExpenseHistory(parsedId.data, {
      limit: parsedLimit.data
    })
    return { data }
  } catch {
    return { error: "No se pudo cargar el historial. Intenta de nuevo" }
  }
}
