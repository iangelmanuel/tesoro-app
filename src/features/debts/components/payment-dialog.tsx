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
import { todayISO } from "@/libs/dates"
import { recordPayment, updateEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import type { PaymentFormState } from "../types"
import { DatePicker } from "./date-picker"
import { Field, amountInput } from "./field"

interface PaymentDialogProps {
  debt: Pick<Debt, "id" | "kind">
  /** Si llega, el diálogo edita este pago */
  entry?: DebtEntry
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Pago de tarjeta o préstamo, o abono de una cuenta por cobrar */
export function PaymentDialog({
  debt,
  entry,
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = entry !== undefined
  const noun = debt.kind === "receivable" ? "abono" : "pago"

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Editar ${noun}` : `Registrar ${noun}`}
          </DialogTitle>
          <DialogDescription>
            {isEditing && entry.transaction_id
              ? "El movimiento enlazado se actualiza con el monto y la fecha."
              : debt.kind === "receivable"
                ? "Lo que te pagaron de esta cuenta por cobrar."
                : "Lo que pagaste de esta deuda."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <PaymentForm
          debt={debt}
          entry={entry}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface PaymentFormProps {
  debt: Pick<Debt, "id" | "kind">
  entry?: DebtEntry
  onSaved: () => void
  onCancel: () => void
}

function PaymentForm({ debt, entry, onSaved, onCancel }: PaymentFormProps) {
  const isEditing = entry !== undefined
  const isReceivable = debt.kind === "receivable"
  const [occurredOn, setOccurredOn] = useState(
    () => entry?.occurred_on ?? todayISO()
  )

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateEntry(prevState, formData)
      : await recordPayment(prevState, formData)

    if (result.ok) {
      const noun = isReceivable ? "Abono" : "Pago"
      toast.success(isEditing ? `${noun} actualizado` : `${noun} registrado`)
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
      <input
        type="hidden"
        name="occurred_on"
        value={occurredOn}
      />

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
            defaultValue={values?.amount ?? amountInput(entry?.amount)}
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
          placeholder={isReceivable ? "Primer abono" : "Cuota de noviembre"}
          defaultValue={values?.note ?? entry?.note ?? ""}
          aria-invalid={Boolean(errors?.note) || undefined}
        />
      </Field>

      {/* El movimiento solo se crea al registrar; al editar, el trigger
          sincroniza el que ya existe */}
      {!isEditing &&
        (debt.kind === "credit_card" ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Las compras con tarjeta se registran como gasto al comprar. Este
            pago no crea un movimiento.
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="create_transaction"
              className="size-4 accent-primary"
              defaultChecked={
                values ? values.create_transaction === "on" : true
              }
            />
            {isReceivable ? "Registrar como ingreso" : "Registrar como gasto"}
          </label>
        ))}

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
