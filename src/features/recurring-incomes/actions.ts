"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import {
  type Workspace,
  getPersonalWorkspace,
  requireWritableWorkspace
} from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { recurringIncomeSchema } from "./schemas"
import type {
  RecurringIncomeActionResult,
  RecurringIncomeFormState
} from "./types"

const NOT_FOUND = "No se encontró el ingreso fijo"
const DEFAULT_ERROR = "No se pudo guardar el ingreso fijo. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de ingreso"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"
const INVALID_ACCOUNT = "Elige una cuenta válida"
const ARCHIVED_ACCOUNT = "Esta cuenta está archivada. Elige otra"

const FIELDS = [
  "name",
  "amount",
  "category_id",
  "account_id",
  "frequency",
  "day_of_month",
  "second_day_of_month",
  "month_of_year",
  "day_of_week",
  "interval_days",
  "starts_on",
  "ends_on"
] as const

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, RecurringIncomeFormState> = {
  // check_recurring_income y los check de la tabla
  "23514": { error: DEFAULT_ERROR },
  // FK de category_id o account_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este ingreso fijo" }
}

// Los ingresos fijos solo existen en Personal; las escrituras pasan por
// requireWritableWorkspace como en el resto de espacios
async function requirePersonalWorkspace(): Promise<Workspace> {
  const personal = await getPersonalWorkspace()
  return requireWritableWorkspace(personal.id)
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
): RecurringIncomeFormState {
  return {
    ...(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR }),
    values
  }
}

function parseForm(formData: FormData) {
  const values = readValues(formData)
  const parsed = recurringIncomeSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

// La categoría debe existir, ser visible para el usuario (RLS), ser de
// ingreso y estar activa. La cuenta, si llega, debe ser del espacio y estar
// activa.
async function validateReferences(
  workspaceId: string,
  categoryId: string,
  accountId: string | null
): Promise<RecurringIncomeFormState["fieldErrors"] | null> {
  const supabase = await createClient()
  const [{ data: category }, account] = await Promise.all([
    supabase
      .from("categories")
      .select("type, archived_at")
      .eq("id", categoryId)
      .maybeSingle(),
    accountId === null
      ? Promise.resolve(null)
      : supabase
          .from("accounts")
          .select("archived_at")
          .eq("id", accountId)
          .eq("workspace_id", workspaceId)
          .maybeSingle()
  ])

  if (!category || category.type !== "income") {
    return { category_id: [INVALID_CATEGORY] }
  }
  if (category.archived_at !== null) {
    return { category_id: [ARCHIVED_CATEGORY] }
  }
  if (account !== null) {
    if (!account.data) {
      return { account_id: [INVALID_ACCOUNT] }
    }
    if (account.data.archived_at !== null) {
      return { account_id: [ARCHIVED_ACCOUNT] }
    }
  }
  return null
}

export async function createRecurringIncome(
  _prevState: RecurringIncomeFormState,
  formData: FormData
): Promise<RecurringIncomeFormState> {
  const { values, parsed } = parseForm(formData)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requirePersonalWorkspace()
  const referenceErrors = await validateReferences(
    workspace.id,
    parsed.data.category_id,
    parsed.data.account_id
  )
  if (referenceErrors) {
    return { fieldErrors: referenceErrors, values }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("recurring_incomes")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return toFormError(error, values)
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateRecurringIncome(
  _prevState: RecurringIncomeFormState,
  formData: FormData
): Promise<RecurringIncomeFormState> {
  const { values, parsed } = parseForm(formData)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requirePersonalWorkspace()
  const referenceErrors = await validateReferences(
    workspace.id,
    parsed.data.category_id,
    parsed.data.account_id
  )
  if (referenceErrors) {
    return { fieldErrors: referenceErrors, values }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
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
export async function toggleRecurringIncome(
  id: string,
  active: boolean
): Promise<RecurringIncomeActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requirePersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
    .update({ is_active: active === true })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo actualizar el ingreso fijo. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}

// Los movimientos recibidos se conservan: la FK los deja con el enlace en null
export async function deleteRecurringIncome(
  id: string
): Promise<RecurringIncomeActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await requirePersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_incomes")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el ingreso fijo. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}
