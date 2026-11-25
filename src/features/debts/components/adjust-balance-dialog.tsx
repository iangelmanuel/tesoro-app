"use client"

import { useActionState, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { todayISO } from "@/libs/dates"
import { adjustBalance } from "../entry-actions"
import type { Debt } from "../queries"
import type { AdjustBalanceFormState } from "../types"

interface AdjustBalanceDialogProps {
  debt: Pick<Debt, "id" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
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
  open,
  onOpenChange
}: AdjustBalanceDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title="Actualizar saldo"
      description={
        <>
          Saldo actual:{" "}
          <Amount
            value={debt.balance}
            currency={currency}
          />
          . Escribe el saldo real, por ejemplo el de tu extracto. No crea un
          movimiento.
        </>
      }
    >
      {(close) => (
        <AdjustBalanceForm
          debt={debt}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
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

      <TextInputField
        name="balance"
        label="Saldo en tu banco"
        help="balance.real"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={values?.balance ?? ""}
        isRequired
        error={errors?.balance?.[0]}
      />

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

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder="Extracto de octubre"
        defaultValue={values?.note ?? ""}
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
          {pending ? "Guardando..." : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
