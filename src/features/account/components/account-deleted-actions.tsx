"use client"

import { useTransition } from "react"
import { Button, toast } from "@heroui/react"
import { signOut } from "@/features/auth/actions"
import { cancelAccountDeletion } from "../actions"

/** "Restaurar cuenta" y "Cerrar sesión" de /account-deleted */
export function AccountDeletedActions() {
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const result = await cancelAccountDeletion()
      if (result?.error) {
        toast.danger(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        isDisabled={pending}
        onPress={restore}
      >
        {pending ? "Restaurando..." : "Restaurar cuenta"}
      </Button>
      <Button
        variant="ghost"
        isDisabled={pending}
        onPress={() => startTransition(() => signOut())}
      >
        Cerrar sesión
      </Button>
    </div>
  )
}
