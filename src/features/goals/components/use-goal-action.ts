"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import { archiveGoal, completeGoal, reactivateGoal } from "../actions"

const ACTIONS = {
  complete: { run: completeGoal, success: "se marcó como cumplida" },
  archive: { run: archiveGoal, success: "se archivó" },
  reactivate: { run: reactivateGoal, success: "se reactivó" }
} as const

export type GoalAction = keyof typeof ACTIONS

/** Cambia el estado de una meta y avisa con un toast */
export function useGoalAction(goal: { id: string; name: string }) {
  const { pending, run: runWithToast } = useActionToast()

  function run(action: GoalAction) {
    runWithToast(
      () => ACTIONS[action].run(goal.id),
      `"${goal.name}" ${ACTIONS[action].success}`
    )
  }

  return { pending, run }
}
