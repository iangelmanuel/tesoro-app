"use client"

import { AlertDialog, Button } from "@heroui/react"

interface ArchiveDebtDialogProps {
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirmación al archivar una deuda que todavía tiene saldo */
export function ArchiveDebtDialog({
  name,
  open,
  onOpenChange,
  onConfirm
}: ArchiveDebtDialogProps) {
  return (
    <AlertDialog>
      <AlertDialog.Backdrop
        isKeyboardDismissDisabled={false}
        isOpen={open}
        onOpenChange={onOpenChange}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Heading>
                ¿Archivar &quot;{name}&quot;?
              </AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  Esta deuda tiene saldo. Al archivarla sale de los totales y de
                  los próximos pagos.
                </p>
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                onPress={onConfirm}
              >
                Archivar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
