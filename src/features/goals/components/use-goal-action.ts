"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { archiveGoal, completeGoal, reactivateGoal } from "../actions"

const ACTIONS = {
  complete: { run: completeGoal, success: "se marcó como cumplida" },
  archive: { run: archiveGoal, success: "se archivó" },
  reactivate: { run: reactivateGoal, success: "se reactivó" }
} as const

export type GoalAction = keyof typeof ACTIONS

/** Cambia el estado de una meta y avisa con un toast */
export function useGoalAction(goal: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function run(action: GoalAction) {
    startTransition(async () => {
      const result = await ACTIONS[action].run(goal.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${goal.name}" ${ACTIONS[action].success}`)
      }
    })
  }

  return { pending, run }
}
