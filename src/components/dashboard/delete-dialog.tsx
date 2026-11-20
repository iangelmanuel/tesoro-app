"use client"

import { Trash2 } from "lucide-react"
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

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Texto del cuerpo: qué se pierde y si se puede deshacer */
  children: React.ReactNode
  onConfirm: () => void
  confirmLabel?: string
}

/**
 * Confirmación de borrado controlada. Se abre desde `RowActions` (el menú de
 * escritorio no puede alojar el trigger del diálogo). Cancelar es la acción
 * segura y va primero; Escape también cancela
 */
export function DeleteDialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  confirmLabel = "Eliminar"
}: DeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive-soft text-destructive-soft-foreground">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {children}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
