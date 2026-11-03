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
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { adjustBalance, updateEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import type { AdjustBalanceFormState } from "../types"
import { amountInput } from "./field"

interface AdjustBalanceDialogProps {
  debt: Pick<Debt, "id" | "balance">
  /** Si llega, el diálogo edita este ajuste */
  entry?: DebtEntry
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "Actualizar saldo": el usuario escribe el saldo real (por ejemplo, el del
 * extracto) y se guarda un ajuste por la diferencia
 */
export function AdjustBalanceDialog({
  debt,
  entry,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AdjustBalanceDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = entry !== undefined

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
                {isEditing ? "Editar ajuste" : "Actualizar saldo"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                Saldo actual: {formatCurrency(debt.balance, currency)}. Escribe
                el saldo real, por ejemplo el de tu extracto. No crea un
                movimiento.
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <AdjustBalanceForm
                debt={debt}
                entry={entry}
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
  debt: Pick<Debt, "id" | "balance">
  entry?: DebtEntry
  onSaved: () => void
  onCancel: () => void
}

function AdjustBalanceForm({
  debt,
  entry,
  onSaved,
  onCancel
}: AdjustBalanceFormProps) {
  const isEditing = entry !== undefined
  const [occurredOn, setOccurredOn] = useState(
    () => entry?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => entry?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    AdjustBalanceFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateEntry(prevState, formData)
      : await adjustBalance(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Ajuste actualizado" : "Saldo actualizado")
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
      {isEditing ? (
        <input
          type="hidden"
          name="id"
          value={entry.id}
        />
      ) : (
        <input
          type="hidden"
          name="debt_id"
          value={debt.id}
        />
      )}

      <TextField
        name="balance"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={
          values?.balance ?? (isEditing ? amountInput(debt.balance) : "")
        }
        isRequired
        isInvalid={Boolean(errors?.balance)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Saldo real</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.balance?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
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
        defaultValue={values?.note ?? entry?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder="Extracto de octubre" />
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
