"use server"

import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import {
  type Workspace,
  getPersonalWorkspace,
  requireWritableWorkspace
} from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { getRecurringIncomeHistory } from "./history-queries"
import type { RecurringIncomeHistory } from "./income-history"
import { recurringIncomeSchema } from "./schemas"
import {
  RECURRING_INCOME_NOT_FOUND,
  createRecurringIncomeRecord,
  deleteRecurringIncomeRecord,
  setRecurringIncomeActiveRecord,
  updateRecurringIncomeRecord
} from "./service"
import type {
  RecurringIncomeActionResult,
  RecurringIncomeFormState
} from "./types"

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

// Los ingresos fijos solo existen en Personal; las escrituras pasan por
// requireWritableWorkspace como en el resto de espacios
async function requirePersonalWorkspace(): Promise<Workspace> {
  const personal = await getPersonalWorkspace()
  return requireWritableWorkspace(personal.id)
}

function parseForm(formData: FormData) {
  const values = readFormValues(formData, FIELDS)
  const parsed = recurringIncomeSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
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
  const result = await createRecurringIncomeRecord(
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

export async function updateRecurringIncome(
  _prevState: RecurringIncomeFormState,
  formData: FormData
): Promise<RecurringIncomeFormState> {
  const { values, parsed } = parseForm(formData)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: RECURRING_INCOME_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await requirePersonalWorkspace()
  const result = await updateRecurringIncomeRecord(
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
export async function toggleRecurringIncome(
  id: string,
  active: boolean
): Promise<RecurringIncomeActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: RECURRING_INCOME_NOT_FOUND }
  }

  const workspace = await requirePersonalWorkspace()
  const result = await setRecurringIncomeActiveRecord(
    await createClient(),
    workspace,
    parsedId.data,
    active === true
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}

export async function deleteRecurringIncome(
  id: string
): Promise<RecurringIncomeActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: RECURRING_INCOME_NOT_FOUND }
  }

  const workspace = await requirePersonalWorkspace()
  const result = await deleteRecurringIncomeRecord(
    await createClient(),
    workspace,
    parsedId.data
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}

/** Tope de ocurrencias del historial: unos 5 años de un ingreso diario */
const MAX_HISTORY_LIMIT = 2000

export type RecurringIncomeHistoryResult =
  | { data: RecurringIncomeHistory; error?: undefined }
  | { data?: undefined; error: string }

// Lectura para el Sheet de un ingreso fijo: se pide al abrirlo, con "Ver
// más" y tras registrar un cobro desde él. RLS limita a los del usuario.
export async function loadRecurringIncomeHistory(
  id: string,
  limit: number
): Promise<RecurringIncomeHistoryResult> {
  const parsedId = idSchema.safeParse(id)
  const parsedLimit = z.int().min(1).max(MAX_HISTORY_LIMIT).safeParse(limit)

  if (!parsedId.success || !parsedLimit.success) {
    return { error: RECURRING_INCOME_NOT_FOUND }
  }

  try {
    const data = await getRecurringIncomeHistory(parsedId.data, {
      limit: parsedLimit.data
    })
    return { data }
  } catch {
    return { error: "No se pudo cargar el historial. Intenta de nuevo" }
  }
}
