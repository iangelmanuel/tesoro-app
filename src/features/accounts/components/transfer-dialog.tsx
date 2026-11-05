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
import { AccountSelectField } from "@/components/forms/account-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { amountInput } from "@/features/debts/components/field"
import { todayISO } from "@/libs/dates"
import { createTransfer, updateTransfer } from "../actions"
import type { TransferFormState } from "../types"
import { type AccountOption, selectableAccounts } from "./account-select"

export interface TransferValues {
  id: string
  from_account_id: string
  to_account_id: string
  amount: number
  occurred_on: string
  occurred_time: string | null
  note: string | null
}

interface TransferDialogProps {
  /** Espacio del traspaso */
  workspaceId: string
  /** Todas las cuentas del espacio; solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita este traspaso */
  transfer?: TransferValues
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TransferDialog({
  workspaceId,
  accounts,
  transfer,
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransferDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = transfer !== undefined

  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar traspaso" : "Nuevo traspaso"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                Mueve plata entre tus cuentas. No cuenta como ingreso ni gasto.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <TransferForm
                workspaceId={workspaceId}
                accounts={accounts}
                transfer={transfer}
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

export interface TransferFormProps {
  workspaceId: string
  accounts: AccountOption[]
  transfer?: TransferValues
  onSaved: () => void
  onCancel: () => void
}

/** Formulario de traspaso; también lo usa el diálogo de movimientos */
export function TransferForm({
  workspaceId,
  accounts,
  transfer,
  onSaved,
  onCancel
}: TransferFormProps) {
  const isEditing = transfer !== undefined
  const [fromId, setFromId] = useState(transfer?.from_account_id ?? "")
  const [toId, setToId] = useState(transfer?.to_account_id ?? "")
  const [occurredOn, setOccurredOn] = useState(
    () => transfer?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => transfer?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    TransferFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateTransfer(prevState, formData)
      : await createTransfer(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Traspaso actualizado" : "Traspaso registrado")
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
      {isEditing && (
        <input
          type="hidden"
          name="id"
          value={transfer.id}
        />
      )}
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AccountSelectField
          workspaceId={workspaceId}
          name="from_account_id"
          label="Desde"
          value={fromId}
          onChange={setFromId}
          accounts={selectableAccounts(accounts, transfer?.from_account_id)}
          placeholder="Cuenta de origen"
          error={errors?.from_account_id?.[0]}
        />

        <AccountSelectField
          workspaceId={workspaceId}
          name="to_account_id"
          label="Hacia"
          value={toId}
          onChange={setToId}
          accounts={selectableAccounts(accounts, transfer?.to_account_id)}
          placeholder="Cuenta de destino"
          error={errors?.to_account_id?.[0]}
        />
      </div>

      <TextField
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={values?.amount ?? amountInput(transfer?.amount)}
        isRequired
        isInvalid={Boolean(errors?.amount)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Monto</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.amount?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          value={time}
          onChange={setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? transfer?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder="Retiro en cajero" />
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}
