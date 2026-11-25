"use client"

import { FormDialog } from "@/components/forms/form-dialog"
import { type AccountOption } from "@/features/accounts/components/account-select"
import type { Debt } from "../queries"
import { DebtDialogForm } from "./debt-dialog-form"

interface DebtDialogProps {
  /** Espacio de la deuda (para crear una cuenta desde el select) */
  workspaceId: string
  /** Cuentas del espacio (cuenta por defecto); solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita esta tarjeta o préstamo */
  debt?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DebtDialog({
  workspaceId,
  accounts,
  debt,
  trigger,
  open,
  onOpenChange
}: DebtDialogProps) {
  const isEditing = debt !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      title={isEditing ? "Editar deuda" : "Nueva deuda"}
      description={
        isEditing
          ? "Cambia los datos de la deuda. Sus pagos y ajustes no cambian."
          : "Una tarjeta de crédito o un préstamo que estás pagando."
      }
    >
      {(close) => (
        <DebtDialogForm
          workspaceId={workspaceId}
          accounts={accounts}
          debt={debt}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}
