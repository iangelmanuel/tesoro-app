"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Modal,
  TextField,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldLabel } from "@/components/forms/field-label"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { adjustBalance } from "../actions"
import type { Debt } from "../queries"
import type { AdjustBalanceFormState } from "../types"

interface AdjustBalanceDialogProps {
  debt: Pick<Debt, "id" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "Actualizar saldo": el usuario escribe el saldo real (por ejemplo, el del
 * extracto) y se guarda un ajuste por la diferencia. Editar un ajuste va por
 * DebtEntryDialog (SPEC 42)
 */
export function AdjustBalanceDialog({
  debt,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AdjustBalanceDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

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
              <Modal.Heading>Actualizar saldo</Modal.Heading>
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

function AdjustBalanceForm({
  debt,
  onSaved,
  onCancel
}: {
  debt: Pick<Debt, "id" | "balance">
  onSaved: () => void
  onCancel: () => void
}) {
  const [occurredOn, setOccurredOn] = useState(() => todayISO())
  const [time, setTime] = useState("")

  const [state, formAction, pending] = useActionState<
    AdjustBalanceFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await adjustBalance(prevState, formData)
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
        name="debt_id"
        value={debt.id}
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
        <FieldLabel help="balance.real">Saldo real</FieldLabel>
        <Input placeholder="0" />
        <FieldError>{errors?.balance?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          help="balance.date"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
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

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <FieldLabel help="common.note">Nota (opcional)</FieldLabel>
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
          {pending ? "Guardando..." : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
