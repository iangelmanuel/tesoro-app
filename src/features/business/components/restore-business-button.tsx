"use client"

import { useTransition } from "react"
import { Button, toast } from "@heroui/react"
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
        toast.danger(result.error)
      }
    })
  }

  return (
    <Button
      isDisabled={pending}
      onPress={restore}
    >
      {pending ? "Restaurando..." : "Restaurar empresa"}
    </Button>
  )
}
