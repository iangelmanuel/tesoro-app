"use client"

import { useTransition } from "react"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { copyPreviousMonthBudgets } from "../actions"

interface CopyPreviousMonthButtonProps {
  /** Mes destino (YYYY-MM) */
  month: string
}

export function CopyPreviousMonthButton({
  month
}: CopyPreviousMonthButtonProps) {
  const [pending, startTransition] = useTransition()

  function handleCopy() {
    startTransition(async () => {
      const result = await copyPreviousMonthBudgets(month)
      if (result.error) {
        toast.error(result.error)
      } else if (result.copied) {
        toast.success(`Se copiaron ${result.copied} presupuestos`)
      } else {
        toast.info("No hay presupuestos nuevos para copiar")
      }
    })
  }

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={handleCopy}
    >
      <Copy data-icon="inline-start" />
      {pending ? "Copiando..." : "Copiar del mes anterior"}
    </Button>
  )
}
