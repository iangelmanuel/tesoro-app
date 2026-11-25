"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import { archiveDebt, markDebtPaid, reactivateDebt } from "../debt-actions"

const ACTIONS = {
  markPaid: { run: markDebtPaid, success: "se marcó como pagada" },
  markCollected: { run: markDebtPaid, success: "se marcó como cobrada" },
  archive: { run: archiveDebt, success: "se archivó" },
  reactivate: { run: reactivateDebt, success: "se reactivó" }
} as const

export type DebtAction = keyof typeof ACTIONS

/** Cambia el estado de una deuda y avisa con un toast */
export function useDebtAction(debt: { id: string; name: string }) {
  const { pending, run: runWithToast } = useActionToast()

  function run(action: DebtAction) {
    runWithToast(
      () => ACTIONS[action].run(debt.id),
      `"${debt.name}" ${ACTIONS[action].success}`
    )
  }

  return { pending, run }
}
