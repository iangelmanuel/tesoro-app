"use client"

import { Archive } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"

interface ArchiveDebtDialogProps {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * Confirmación al archivar una deuda que todavía tiene saldo. Cancelar es la
 * acción segura y va primero; Escape también cancela
 */
export function ArchiveDebtDialog({
  name,
  open,
  onOpenChange,
  onConfirm
}: ArchiveDebtDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning-soft text-warning-soft-foreground">
            <Archive />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Archivar &quot;{name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta deuda tiene saldo. Al archivarla sale de los totales y de los
            próximos pagos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            Archivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
