"use client"

import { useState, useTransition } from "react"
import { Copy } from "lucide-react"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { copyPreviousMonthBudgets } from "../actions"

interface CopyPreviousMonthButtonProps {
  /** Mes destino (YYYY-MM) */
  month: string
}

/**
 * "Copiar del mes anterior" con confirmación: trae los presupuestos del mes
 * anterior que aún no existen en este. Cancelar es la acción segura y va
 * primero; Escape también cancela
 */
export function CopyPreviousMonthButton({
  month
}: CopyPreviousMonthButtonProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleCopy() {
    startTransition(async () => {
      const result = await copyPreviousMonthBudgets(month)
      if (result.error) {
        toast.error(result.error)
      } else if (result.copied) {
        toast.success(
          result.copied === 1
            ? "1 presupuesto copiado"
            : `${result.copied} presupuestos copiados`
        )
      } else {
        toast.info("No hay presupuestos nuevos para copiar")
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={setOpen}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            className={CONTROL_BUTTON}
            disabled={pending}
            data-tour="budgets-copy"
          />
        }
      >
        <Copy />
        {pending ? "Copiando..." : "Copiar del mes anterior"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-subtle text-foreground">
            <Copy />
          </AlertDialogMedia>
          <AlertDialogTitle>
            ¿Copiar los presupuestos del mes anterior?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se crean en este mes los presupuestos que aún no tiene, con el mismo
            monto. Los que ya existen no cambian.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false)
              handleCopy()
            }}
          >
            Copiar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
