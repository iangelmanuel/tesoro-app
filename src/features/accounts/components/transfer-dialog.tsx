"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/features/debts/components/date-picker"
import { Field, amountInput } from "@/features/debts/components/field"
import { todayISO } from "@/libs/dates"
import { createTransfer, updateTransfer } from "../actions"
import type { TransferFormState } from "../types"
import {
  type AccountOption,
  AccountSelect,
  selectableAccounts
} from "./account-select"

export interface TransferValues {
  id: string
  from_account_id: string
  to_account_id: string
  amount: number
  occurred_on: string
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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar traspaso" : "Nuevo traspaso"}
          </DialogTitle>
          <DialogDescription>
            Mueve plata entre tus cuentas. No cuenta como ingreso ni gasto.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <TransferForm
          workspaceId={workspaceId}
          accounts={accounts}
          transfer={transfer}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface TransferFormProps {
  workspaceId: string
  accounts: AccountOption[]
  transfer?: TransferValues
  onSaved: () => void
  onCancel: () => void
}

function TransferForm({
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
      <input
        type="hidden"
        name="occurred_on"
        value={occurredOn}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="from_account_id"
          label="Desde"
          errors={errors?.from_account_id}
        >
          <AccountSelect
            id="from_account_id"
            name="from_account_id"
            value={fromId}
            onChange={setFromId}
            accounts={selectableAccounts(accounts, transfer?.from_account_id)}
            placeholder="Cuenta de origen"
            invalid={Boolean(errors?.from_account_id)}
          />
        </Field>

        <Field
          id="to_account_id"
          label="Hacia"
          errors={errors?.to_account_id}
        >
          <AccountSelect
            id="to_account_id"
            name="to_account_id"
            value={toId}
            onChange={setToId}
            accounts={selectableAccounts(accounts, transfer?.to_account_id)}
            placeholder="Cuenta de destino"
            invalid={Boolean(errors?.to_account_id)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="amount"
          label="Monto"
          errors={errors?.amount}
        >
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            defaultValue={values?.amount ?? amountInput(transfer?.amount)}
            aria-invalid={Boolean(errors?.amount) || undefined}
            required
          />
        </Field>

        <Field
          id="occurred_on"
          label="Fecha"
          errors={errors?.occurred_on}
        >
          <DatePicker
            id="occurred_on"
            value={occurredOn}
            onChange={setOccurredOn}
            allowFuture
          />
        </Field>
      </div>

      <Field
        id="note"
        label="Nota (opcional)"
        errors={errors?.note}
      >
        <Input
          id="note"
          name="note"
          maxLength={120}
          placeholder="Retiro en cajero"
          defaultValue={values?.note ?? transfer?.note ?? ""}
          aria-invalid={Boolean(errors?.note) || undefined}
        />
      </Field>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <DialogFooter>
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
      </DialogFooter>
    </form>
  )
}
