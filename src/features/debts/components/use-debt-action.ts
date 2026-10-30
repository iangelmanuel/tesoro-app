"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { archiveDebt, markDebtPaid, reactivateDebt } from "../actions"

const ACTIONS = {
  markPaid: { run: markDebtPaid, success: "se marcó como pagada" },
  markCollected: { run: markDebtPaid, success: "se marcó como cobrada" },
  archive: { run: archiveDebt, success: "se archivó" },
  reactivate: { run: reactivateDebt, success: "se reactivó" }
} as const

export type DebtAction = keyof typeof ACTIONS

/** Cambia el estado de una deuda y avisa con un toast */
export function useDebtAction(debt: { id: string; name: string }) {
  const [pending, startTransition] = useTransition()

  function run(action: DebtAction) {
    startTransition(async () => {
      const result = await ACTIONS[action].run(debt.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${debt.name}" ${ACTIONS[action].success}`)
      }
    })
  }

  return { pending, run }
}
