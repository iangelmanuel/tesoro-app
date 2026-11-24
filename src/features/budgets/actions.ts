"use server"

import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { monthParamSchema } from "./month"
import { budgetSchema } from "./schemas"
import {
  NOT_FOUND,
  copyPreviousMonthBudgetRecords,
  deleteBudgetRecord,
  setBudgetRecord
} from "./service"
import type {
  BudgetActionResult,
  BudgetFormState,
  CopyBudgetsResult
} from "./types"

// Los presupuestos solo existen en Personal: el espacio se resuelve con la
// sesión, que nunca tiene marca de borrado

const FIELDS = ["category_id", "month", "amount"] as const

const idSchema = z.uuid()

// Crea el presupuesto de la categoría en el mes o, si ya existe, cambia su
// monto (único por espacio, categoría y mes)
export async function upsertBudget(
  _prevState: BudgetFormState,
  formData: FormData
): Promise<BudgetFormState> {
  const values = readFormValues(formData, FIELDS)
  const parsed = budgetSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const result = await setBudgetRecord(
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

export async function deleteBudget(id: string): Promise<BudgetActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const result = await deleteBudgetRecord(
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

// Copia al mes YYYY-MM los presupuestos del mes anterior que falten
export async function copyPreviousMonthBudgets(
  month: string
): Promise<CopyBudgetsResult> {
  const parsedMonth = monthParamSchema.safeParse(month)

  if (!parsedMonth.success) {
    return { error: "Elige un mes válido" }
  }

  const workspace = await getPersonalWorkspace()
  const result = await copyPreviousMonthBudgetRecords(
    await createClient(),
    workspace,
    parsedMonth.data
  )

  if (!result.ok) {
    return { error: result.error }
  }
  if (result.copied > 0) {
    revalidatePersonalPages()
  }
  return { copied: result.copied }
}
