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
import { formatCurrency } from "@/libs/format"
import { adjustBalance, updateEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import type { AdjustBalanceFormState } from "../types"
import { DatePicker } from "./date-picker"
import { Field, amountInput } from "./field"

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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar ajuste" : "Actualizar saldo"}
          </DialogTitle>
          <DialogDescription>
            Saldo actual: {formatCurrency(debt.balance, currency)}. Escribe el
            saldo real, por ejemplo el de tu extracto. No crea un movimiento.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <AdjustBalanceForm
          debt={debt}
          entry={entry}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
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
      <input
        type="hidden"
        name="occurred_on"
        value={occurredOn}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="balance"
          label="Saldo real"
          errors={errors?.balance}
        >
          <Input
            id="balance"
            name="balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            defaultValue={
              values?.balance ?? (isEditing ? amountInput(debt.balance) : "")
            }
            aria-invalid={Boolean(errors?.balance) || undefined}
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
          placeholder="Extracto de octubre"
          defaultValue={values?.note ?? entry?.note ?? ""}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Actualizar"}
        </Button>
      </DialogFooter>
    </form>
  )
}
