"use server"

import type { PostgrestError } from "@supabase/supabase-js"
import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/libs/revalidate"
import { createClient } from "@/libs/supabase/server"
import { contributionSchema, goalSchema } from "./schemas"
import type {
  ContributionFormState,
  GoalActionResult,
  GoalFormState
} from "./types"

type GoalStatus = "active" | "completed" | "archived"

const GOAL_NOT_FOUND = "No se encontró la meta"
const CONTRIBUTION_NOT_FOUND = "No se encontró el aporte"
const GOAL_DEFAULT_ERROR = "No se pudo guardar la meta. Intenta de nuevo"
const CONTRIBUTION_DEFAULT_ERROR =
  "No se pudo guardar el aporte. Intenta de nuevo"
const GOAL_NOT_ACTIVE = "Reactiva la meta para registrar aportes"
const OVER_WITHDRAWAL = "No puedes retirar más de lo ahorrado"
const FUTURE_DATE = "La fecha no puede ser futura"

const GOAL_FIELDS = [
  "name",
  "target_amount",
  "target_date",
  "icon",
  "color"
] as const

const CONTRIBUTION_FIELDS = ["kind", "amount", "occurred_on", "note"] as const

const idSchema = z.uuid()

// Errores de Postgres que pueden llegar pese a la validación con Zod
const GOAL_PG_ERRORS: Record<string, GoalFormState> = {
  // check de la tabla
  "23514": { error: GOAL_DEFAULT_ERROR },
  // RLS
  "42501": { error: "No tienes permiso para modificar esta meta" }
}

// Los triggers de goal_contributions lanzan check_violation con su mensaje
function contributionPgError(error: PostgrestError): ContributionFormState {
  if (error.message.includes(OVER_WITHDRAWAL)) {
    return { fieldErrors: { amount: [OVER_WITHDRAWAL] } }
  }
  if (error.message.includes(GOAL_NOT_ACTIVE)) {
    return { error: GOAL_NOT_ACTIVE }
  }
  if (error.message.includes("fecha del aporte")) {
    return { fieldErrors: { occurred_on: [FUTURE_DATE] } }
  }
  if (error.code === "23503") {
    return { error: GOAL_NOT_FOUND }
  }
  if (error.code === "42501") {
    return { error: "No tienes permiso para modificar este aporte" }
  }
  return { error: CONTRIBUTION_DEFAULT_ERROR }
}

function readValues<const T extends readonly string[]>(
  formData: FormData,
  fields: T
) {
  return Object.fromEntries(
    fields.map((key) => {
      const value = formData.get(key)
      return [key, typeof value === "string" ? value : ""]
    })
  ) as Record<T[number], string>
}

// Meta del espacio Personal del usuario
async function findGoal(goalId: string) {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data } = await supabase
    .from("savings_goals")
    .select("id, workspace_id, status, target_date")
    .eq("id", goalId)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  return data
}

// Suma de aportes y retiros de la meta
async function goalSaved(goalId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goal_contributions")
    .select("amount")
    .eq("goal_id", goalId)

  if (error) {
    throw new Error("No se pudieron cargar los aportes")
  }
  return data.reduce((sum, row) => sum + Number(row.amount), 0)
}

export async function createGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const values = readValues(formData, GOAL_FIELDS)
  const parsed = goalSchema().safeParse({
    ...values,
    target_amount: parseAmount(values.target_amount)
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { error } = await supabase
    .from("savings_goals")
    .insert({ ...parsed.data, workspace_id: workspace.id })

  if (error) {
    return {
      ...(GOAL_PG_ERRORS[error.code] ?? { error: GOAL_DEFAULT_ERROR }),
      values
    }
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const values = readValues(formData, GOAL_FIELDS)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: GOAL_NOT_FOUND, values }
  }

  const goal = await findGoal(id.data)
  if (!goal) {
    return { error: GOAL_NOT_FOUND, values }
  }

  const parsed = goalSchema(goal.target_date).safeParse({
    ...values,
    target_amount: parseAmount(values.target_amount)
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("savings_goals")
    .update(parsed.data)
    .eq("id", goal.id)
    .eq("workspace_id", goal.workspace_id)
    .select("id")

  if (error) {
    return {
      ...(GOAL_PG_ERRORS[error.code] ?? { error: GOAL_DEFAULT_ERROR }),
      values
    }
  }
  if (data.length === 0) {
    return { error: GOAL_NOT_FOUND, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Cambia el estado solo si la meta está en uno de los estados `from`
async function transitionGoal(
  id: string,
  from: GoalStatus[],
  to: GoalStatus
): Promise<GoalActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: GOAL_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("savings_goals")
    .update({
      status: to,
      completed_at: to === "completed" ? new Date().toISOString() : null
    })
    .eq("id", parsedId.data)
    .eq("workspace_id", workspace.id)
    .in("status", from)
    .select("id")

  if (error) {
    return { error: "No se pudo actualizar la meta. Intenta de nuevo" }
  }
  if (data.length === 0) {
    return { error: GOAL_NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}

export async function completeGoal(id: string): Promise<GoalActionResult> {
  return transitionGoal(id, ["active"], "completed")
}

export async function archiveGoal(id: string): Promise<GoalActionResult> {
  return transitionGoal(id, ["active", "completed"], "archived")
}

export async function reactivateGoal(id: string): Promise<GoalActionResult> {
  return transitionGoal(id, ["completed", "archived"], "active")
}

function parseContribution(formData: FormData) {
  const values = readValues(formData, CONTRIBUTION_FIELDS)
  const parsed = contributionSchema.safeParse({
    ...values,
    amount: parseAmount(values.amount)
  })
  return { values, parsed }
}

export async function createContribution(
  _prevState: ContributionFormState,
  formData: FormData
): Promise<ContributionFormState> {
  const { values, parsed } = parseContribution(formData)
  const goalId = idSchema.safeParse(formData.get("goal_id"))

  if (!goalId.success) {
    return { error: GOAL_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const goal = await findGoal(goalId.data)
  if (!goal) {
    return { error: GOAL_NOT_FOUND, values }
  }
  if (goal.status !== "active") {
    return { error: GOAL_NOT_ACTIVE, values }
  }
  if ((await goalSaved(goal.id)) + parsed.data.amount < 0) {
    return { fieldErrors: { amount: [OVER_WITHDRAWAL] }, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("goal_contributions").insert({
    ...parsed.data,
    goal_id: goal.id,
    workspace_id: goal.workspace_id
  })

  if (error) {
    return { ...contributionPgError(error), values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Aporte del espacio Personal del usuario, con el estado de su meta
async function findContribution(id: string) {
  const workspace = await getPersonalWorkspace()
  const supabase = await createClient()
  const { data } = await supabase
    .from("goal_contributions")
    .select("id, goal_id, amount, goal:savings_goals!inner (status)")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  return data
}

export async function updateContribution(
  _prevState: ContributionFormState,
  formData: FormData
): Promise<ContributionFormState> {
  const { values, parsed } = parseContribution(formData)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: CONTRIBUTION_NOT_FOUND, values }
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const contribution = await findContribution(id.data)
  if (!contribution) {
    return { error: CONTRIBUTION_NOT_FOUND, values }
  }
  if (contribution.goal.status !== "active") {
    return { error: GOAL_NOT_ACTIVE, values }
  }

  const saved = await goalSaved(contribution.goal_id)
  if (saved - Number(contribution.amount) + parsed.data.amount < 0) {
    return { fieldErrors: { amount: [OVER_WITHDRAWAL] }, values }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goal_contributions")
    .update(parsed.data)
    .eq("id", contribution.id)
    .select("id")

  if (error) {
    return { ...contributionPgError(error), values }
  }
  if (data.length === 0) {
    return { error: CONTRIBUTION_NOT_FOUND, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function deleteContribution(
  id: string
): Promise<GoalActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: CONTRIBUTION_NOT_FOUND }
  }

  const contribution = await findContribution(parsedId.data)
  if (!contribution) {
    return { error: CONTRIBUTION_NOT_FOUND }
  }
  if (contribution.goal.status !== "active") {
    return { error: GOAL_NOT_ACTIVE }
  }

  const saved = await goalSaved(contribution.goal_id)
  if (saved - Number(contribution.amount) < 0) {
    return { error: OVER_WITHDRAWAL }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goal_contributions")
    .delete()
    .eq("id", contribution.id)
    .select("id")

  if (error) {
    // En un borrado, el único error por campo posible es el del saldo
    const result = contributionPgError(error)
    return { error: result.error ?? result.fieldErrors?.amount?.[0] }
  }
  if (data.length === 0) {
    return { error: CONTRIBUTION_NOT_FOUND }
  }

  revalidatePersonalPages()
  return {}
}
