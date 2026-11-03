"use client"

import { AlertDialog, Button } from "@heroui/react"

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
 * escritorio no puede alojar el trigger del diálogo).
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
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>{children}</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={onConfirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
