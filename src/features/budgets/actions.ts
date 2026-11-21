"use server"

import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { shiftMonth } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import { monthParamSchema, monthStart } from "./month"
import { budgetSchema } from "./schemas"
import { setBudgetRecord } from "./service"
import type {
  BudgetActionResult,
  BudgetFormState,
  CopyBudgetsResult
} from "./types"

const NOT_FOUND = "No se encontró el presupuesto"

const FIELDS = ["category_id", "month", "amount"] as const

const idSchema = z.uuid()

function readValues(formData: FormData) {
  return Object.fromEntries(
    FIELDS.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<(typeof FIELDS)[number], string>
}

// Crea el presupuesto de la categoría en el mes o, si ya existe, cambia su
// monto (único por espacio, categoría y mes)
export async function upsertBudget(
  _prevState: BudgetFormState,
  formData: FormData
): Promise<BudgetFormState> {
  const values = readValues(formData)
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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .select("id")

  if (error) {
    return { error: "No se pudo eliminar el presupuesto. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}

// Copia al mes YYYY-MM los presupuestos del mes anterior que falten. Nunca
// pisa montos ya definidos (on conflict do nothing) y omite las categorías
// archivadas.
export async function copyPreviousMonthBudgets(
  month: string
): Promise<CopyBudgetsResult> {
  const parsedMonth = monthParamSchema.safeParse(month)

  if (!parsedMonth.success) {
    return { error: "Elige un mes válido" }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data: previous, error: readError } = await supabase
    .from("budgets")
    .select("category_id, amount, category:categories!inner (archived_at)")
    .eq("workspace_id", workspace.id)
    .eq("month", monthStart(shiftMonth(parsedMonth.data, -1)))
    .is("category.archived_at", null)

  if (readError) {
    return { error: "No se pudieron copiar los presupuestos. Intenta de nuevo" }
  }
  if (previous.length === 0) {
    return { copied: 0 }
  }

  const { data: inserted, error } = await supabase
    .from("budgets")
    .upsert(
      previous.map((budget) => ({
        workspace_id: workspace.id,
        category_id: budget.category_id,
        month: monthStart(parsedMonth.data),
        amount: budget.amount
      })),
      { onConflict: "workspace_id,category_id,month", ignoreDuplicates: true }
    )
    .select("id")

  if (error) {
    return { error: "No se pudieron copiar los presupuestos. Intenta de nuevo" }
  }

  if (inserted.length > 0) {
    revalidatePersonalPages()
  }
  return { copied: inserted.length }
}
