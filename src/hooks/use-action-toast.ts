"use client"

import { useTransition } from "react"
import { toast } from "@/components/ui/sonner"

/**
 * Corre una server action en una transición y avisa con toast de éxito o
 * error. `onSuccess` corre después del toast de éxito (cerrar un Sheet tras
 * eliminar, por ejemplo).
 */
export function useActionToast() {
  const [pending, startTransition] = useTransition()

  function run(
    action: () => Promise<{ error?: string | null }>,
    success: string,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(success)
        onSuccess?.()
      }
    })
  }

  return { pending, run }
}
