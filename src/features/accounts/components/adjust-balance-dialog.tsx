"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
  toast
} from "@heroui/react"
import { formatCurrency } from "@/libs/format"
import { adjustAccountBalance } from "../actions"
import type { AccountWithBalance, AdjustAccountFormState } from "../types"

interface AdjustBalanceDialogProps {
  account: Pick<AccountWithBalance, "id" | "workspace_id" | "name" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "Actualizar saldo": el usuario escribe el saldo real (por ejemplo, el de la
 * app del banco) y se guarda un ajuste con fecha de hoy por la diferencia
 */
export function AdjustBalanceDialog({
  account,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AdjustBalanceDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <Modal>
      {trigger}
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={setOpen}
      >
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Actualizar saldo de {account.name}</Modal.Heading>
              <p className="text-sm text-muted">
                Saldo actual: {formatCurrency(account.balance, currency)}.
                Escribe el saldo real que ves en tu banco o billetera. No crea
                un movimiento.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <AdjustBalanceForm
                workspaceId={account.workspace_id}
                accountId={account.id}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

interface AdjustBalanceFormProps {
  workspaceId: string
  accountId: string
  onSaved: () => void
  onCancel: () => void
}

function AdjustBalanceForm({
  workspaceId,
  accountId,
  onSaved,
  onCancel
}: AdjustBalanceFormProps) {
  const [state, formAction, pending] = useActionState<
    AdjustAccountFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await adjustAccountBalance(prevState, formData)

    if (result.ok) {
      toast.success("Saldo actualizado")
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="account_id"
        value={accountId}
      />

      <TextField
        name="balance"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={values?.balance ?? ""}
        isRequired
        isInvalid={Boolean(errors?.balance)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Saldo real</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.balance?.[0]}</FieldError>
      </TextField>

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder="Cuadre con la app" />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onPress={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          isDisabled={pending}
        >
          {pending ? "Guardando..." : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
