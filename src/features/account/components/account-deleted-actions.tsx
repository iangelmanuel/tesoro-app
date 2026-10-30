"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"
import { cancelAccountDeletion } from "../actions"

/** "Restaurar cuenta" y "Cerrar sesión" de /account-deleted */
export function AccountDeletedActions() {
  const [pending, startTransition] = useTransition()

  function restore() {
    startTransition(async () => {
      const result = await cancelAccountDeletion()
      if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending}
        onClick={restore}
      >
        {pending ? "Restaurando..." : "Restaurar cuenta"}
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(() => signOut())}
      >
        Cerrar sesión
      </Button>
    </div>
  )
}
