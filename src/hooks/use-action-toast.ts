"use client"

import { useTransition } from "react"
import { toast } from "@/components/ui/sonner"

/** Corre una server action en una transición y avisa con toast de éxito o error */
export function useActionToast() {
  const [pending, startTransition] = useTransition()

  function run(
    action: () => Promise<{ error?: string | null }>,
    success: string
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(success)
      }
    })
  }

  return { pending, run }
}
