"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cancelBusinessDeletion } from "../actions"

/** "Restaurar empresa" de la pantalla de borrado programado */
export function RestoreBusinessButton({
  workspaceId
}: {
  workspaceId: string
}) {
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const result = await cancelBusinessDeletion(workspaceId)
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button
      disabled={pending}
      onClick={restore}
    >
      {pending ? "Restaurando..." : "Restaurar empresa"}
    </Button>
  )
}
