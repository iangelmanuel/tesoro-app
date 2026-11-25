"use server"

import { z } from "zod"
import { parseAmount } from "@/features/transactions/schemas"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import {
  CONTRIBUTION_NOT_FOUND,
  deleteGoalContributionRecord,
  moveGoalContributionRecord,
  recordGoalContributionRecord,
  updateGoalContributionRecord
} from "./contribution-service"
import { contributionSchema, goalSchema } from "./schemas"
import {
  GOAL_NOT_FOUND,
  type GoalRowStatus,
  createGoalRecord,
  loadGoal,
  transitionGoalRecord,
  updateGoalRecord
} from "./service"
import type {
  ContributionFormState,
  GoalActionResult,
  GoalFormState
} from "./types"

const GOAL_FIELDS = [
  "name",
  "target_amount",
  "target_date",
  "icon",
  "color"
] as const

const CONTRIBUTION_FIELDS = [
  "kind",
  "amount",
  "occurred_on",
  "occurred_time",
  "note",
  "account_id",
  "transfer_from",
  "transfer_amount"
] as const

const idSchema = z.uuid()

// Meta del espacio Personal del usuario
async function findGoal(goalId: string) {
  const workspace = await getPersonalWorkspace()
  return loadGoal(await createClient(), workspace.id, goalId)
}

// Al editar, `currentTargetDate` deja conservar una fecha objetivo ya pasada
function parseGoal(
  values: Record<(typeof GOAL_FIELDS)[number], string>,
  currentTargetDate?: string | null
) {
  return goalSchema(currentTargetDate).safeParse({
    ...values,
    target_amount: parseAmount(values.target_amount)
  })
}

export async function createGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const values = readFormValues(formData, GOAL_FIELDS)
  const parsed = parseGoal(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const result = await createGoalRecord(
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

export async function updateGoal(
  _prevState: GoalFormState,
  formData: FormData
): Promise<GoalFormState> {
  const values = readFormValues(formData, GOAL_FIELDS)
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: GOAL_NOT_FOUND, values }
  }

  const goal = await findGoal(id.data)
  if (!goal) {
    return { error: GOAL_NOT_FOUND, values }
  }

  const parsed = parseGoal(values, goal.target_date)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const result = await updateGoalRecord(
    await createClient(),
    { id: goal.workspace_id },
    goal.id,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Cambia el estado solo si la meta está en uno de los estados `from`
async function transitionGoal(
  id: string,
  from: GoalRowStatus[],
  to: GoalRowStatus
): Promise<GoalActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: GOAL_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const result = await transitionGoalRecord(
    await createClient(),
    workspace,
    parsedId.data,
    from,
    to
  )

  if (!result.ok) {
    return { error: result.error }
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
  const values = readFormValues(formData, CONTRIBUTION_FIELDS)
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
  const result = await recordGoalContributionRecord(
    await createClient(),
    goal,
    parsed.data
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
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

  const workspace = await getPersonalWorkspace()
  const result = await updateGoalContributionRecord(
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

export async function deleteContribution(
  id: string
): Promise<GoalActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: CONTRIBUTION_NOT_FOUND }
  }

  const workspace = await getPersonalWorkspace()
  const result = await deleteGoalContributionRecord(
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

// Reordena los aportes y retiros de una meta dentro del mismo día (SPEC 45)
export async function moveContribution(
  id: string,
  targetId: string
): Promise<GoalActionResult> {
  const parsedId = idSchema.safeParse(id)
  const parsedTarget = idSchema.safeParse(targetId)

  if (!parsedId.success || !parsedTarget.success) {
    return { error: CONTRIBUTION_NOT_FOUND }
  }

  const result = await moveGoalContributionRecord(
    await createClient(),
    parsedId.data,
    parsedTarget.data
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}
