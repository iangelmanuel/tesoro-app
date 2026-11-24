"use client"

import { useActionToast } from "@/hooks/use-action-toast"
import { archiveAccount, restoreAccount } from "../actions"

const ACTIONS = {
  archive: { run: archiveAccount, success: "se archivó" },
  restore: { run: restoreAccount, success: "se restauró" }
} as const

export type AccountAction = keyof typeof ACTIONS

/** Archiva o restaura una cuenta y avisa con un toast */
export function useAccountAction(account: {
  id: string
  workspace_id: string
  name: string
}) {
  const { pending, run: runWithToast } = useActionToast()

  function run(action: AccountAction) {
    runWithToast(
      () => ACTIONS[action].run(account.workspace_id, account.id),
      `"${account.name}" ${ACTIONS[action].success}`
    )
  }

  return { pending, run }
}
