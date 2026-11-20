"use client"

import { useActionState, useState } from "react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
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

/**
 * Prellenado de un traspaso nuevo (Duplicar, SPEC 49). Sin fecha ni hora: el
 * traspaso nuevo ocurre hoy. Una cuenta archivada llega como null
 */
export interface TransferInitialValues {
  from_account_id: string | null
  to_account_id: string | null
  amount: number
  note: string
}

interface TransferDialogProps {
  /** Espacio del traspaso */
  workspaceId: string
  /** Todas las cuentas del espacio; solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita este traspaso */
  transfer?: TransferValues
  /** Prellenado de un traspaso nuevo; se ignora al editar */
  initialValues?: TransferInitialValues
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TransferDialog({
  workspaceId,
  accounts,
  transfer,
  initialValues,
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransferDialogProps) {
  const isEditing = transfer !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar traspaso" : "Nuevo traspaso"}
      description="Mueve plata entre tus cuentas. No cuenta como entrada ni salida."
    >
      {(close) => (
        <TransferForm
          workspaceId={workspaceId}
          accounts={accounts}
          transfer={transfer}
          initialValues={isEditing ? undefined : initialValues}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

export interface TransferFormProps {
  workspaceId: string
  accounts: AccountOption[]
  transfer?: TransferValues
  initialValues?: TransferInitialValues
  onSaved: () => void
  onCancel: () => void
}

/** Formulario de traspaso; también lo usa el diálogo de movimientos */
export function TransferForm({
  workspaceId,
  accounts,
  transfer,
  initialValues,
  onSaved,
  onCancel
}: TransferFormProps) {
  const isEditing = transfer !== undefined
  const [fromId, setFromId] = useState(
    transfer?.from_account_id ?? initialValues?.from_account_id ?? ""
  )
  const [toId, setToId] = useState(
    transfer?.to_account_id ?? initialValues?.to_account_id ?? ""
  )
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
          help="transfer.from"
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
          help="transfer.to"
          value={toId}
          onChange={setToId}
          accounts={selectableAccounts(accounts, transfer?.to_account_id)}
          placeholder="Cuenta de destino"
          error={errors?.to_account_id?.[0]}
        />
      </div>

      <TextInputField
        name="amount"
        label="Monto"
        help="transfer.amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={
          values?.amount ??
          amountInput(transfer?.amount ?? initialValues?.amount)
        }
        isRequired
        error={errors?.amount?.[0]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          help="common.date"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          help="common.time"
          value={time}
          onChange={setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder="Retiro en cajero"
        defaultValue={
          values?.note ?? transfer?.note ?? initialValues?.note ?? ""
        }
        error={errors?.note?.[0]}
      />

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}
