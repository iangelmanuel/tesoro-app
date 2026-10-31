"use client"

import { useTransition } from "react"
import { toast } from "sonner"
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
  const [pending, startTransition] = useTransition()

  function run(action: AccountAction) {
    startTransition(async () => {
      const result = await ACTIONS[action].run(account.workspace_id, account.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`"${account.name}" ${ACTIONS[action].success}`)
      }
    })
  }

  return { pending, run }
}
