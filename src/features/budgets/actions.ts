"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { shiftMonth } from "@/libs/dates"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { monthParamSchema, monthStart } from "./month"
import { budgetSchema } from "./schemas"
import type {
  BudgetActionResult,
  BudgetFormState,
  CopyBudgetsResult
} from "./types"

const NOT_FOUND = "No se encontró el presupuesto"
const DEFAULT_ERROR = "No se pudo guardar el presupuesto. Intenta de nuevo"
const INVALID_CATEGORY = "Elige una categoría de gasto"
const ARCHIVED_CATEGORY = "Esta categoría está archivada. Elige otra"

const FIELDS = ["category_id", "month", "amount"] as const

const idSchema = z.uuid()

// Códigos de Postgres que pueden llegar pese a la validación con Zod
const PG_ERROR_MESSAGES: Record<string, BudgetFormState> = {
  // check_expense_category y los check de la tabla
  "23514": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // FK de category_id
  "23503": { fieldErrors: { category_id: [INVALID_CATEGORY] } },
  // RLS
  "42501": { error: "No tienes permiso para modificar este presupuesto" }
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
): BudgetFormState {
  return {
    ...(PG_ERROR_MESSAGES[error.code] ?? { error: DEFAULT_ERROR }),
    values
  }
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

  const categoryError = await validateCategory(parsed.data.category_id)
  if (categoryError) {
    return { fieldErrors: { category_id: [categoryError] }, values }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { ...parsed.data, workspace_id: workspace.id },
      { onConflict: "workspace_id,category_id,month" }
    )

  if (error) {
    return toFormError(error, values)
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
