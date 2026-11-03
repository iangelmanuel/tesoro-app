"use client"

import { useTransition } from "react"
import { Button, toast } from "@heroui/react"
import { Copy } from "lucide-react"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"
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
        toast.danger(result.error)
      } else if (result.copied) {
        toast.success(`Se copiaron ${result.copied} presupuestos`)
      } else {
        toast.info("No hay presupuestos nuevos para copiar")
      }
    })
  }

  return (
    <Button
      variant="ghost"
      className={CONTROL_BUTTON}
      isDisabled={pending}
      onPress={handleCopy}
    >
      <Copy />
      {pending ? "Copiando..." : "Copiar del mes anterior"}
    </Button>
  )
}
