"use client"

import { useActionState, useState } from "react"
import { X } from "lucide-react"
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
import { createDebt, updateDebt } from "../actions"
import type { Debt } from "../queries"
import type { DebtFormState } from "../types"
import { DatePicker } from "./date-picker"
import { Field, amountInput } from "./field"

interface ReceivableDialogProps {
  /** Si llega, el diálogo edita esta cuenta por cobrar */
  receivable?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReceivableDialog({
  receivable,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = receivable !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar cuenta por cobrar" : "Nueva cuenta por cobrar"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos de la cuenta por cobrar. Sus abonos y ajustes no cambian."
              : "Dinero que prestaste o que alguien te debe."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <ReceivableForm
          receivable={receivable}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ReceivableFormProps {
  receivable?: Debt
  onSaved: () => void
  onCancel: () => void
}

function ReceivableForm({
  receivable,
  onSaved,
  onCancel
}: ReceivableFormProps) {
  const isEditing = receivable !== undefined
  const [expectedOn, setExpectedOn] = useState(receivable?.expected_on ?? "")

  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateDebt(prevState, formData)
        : await createDebt(prevState, formData)

      if (result.ok) {
        toast.success(
          isEditing
            ? "Cuenta por cobrar actualizada"
            : "Cuenta por cobrar creada"
        )
        onSaved()
      }
      return result
    },
    {}
  )

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
          value={receivable.id}
        />
      ) : (
        <input
          type="hidden"
          name="kind"
          value="receivable"
        />
      )}
      <input
        type="hidden"
        name="expected_on"
        value={expectedOn}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="name"
          label="Nombre"
          errors={errors?.name}
        >
          <Input
            id="name"
            name="name"
            maxLength={60}
            placeholder="Préstamo a Juan"
            defaultValue={values?.name ?? receivable?.name}
            aria-invalid={Boolean(errors?.name) || undefined}
            required
          />
        </Field>

        <Field
          id="counterparty"
          label="Deudor (opcional)"
          errors={errors?.counterparty}
        >
          <Input
            id="counterparty"
            name="counterparty"
            maxLength={60}
            placeholder="Juan"
            defaultValue={
              values?.counterparty ?? receivable?.counterparty ?? ""
            }
            aria-invalid={Boolean(errors?.counterparty) || undefined}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="opening_balance"
          label={isEditing ? "Monto inicial" : "Monto que te deben"}
          errors={errors?.opening_balance}
        >
          <Input
            id="opening_balance"
            name="opening_balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            defaultValue={
              values?.opening_balance ??
              amountInput(receivable?.opening_balance)
            }
            aria-invalid={Boolean(errors?.opening_balance) || undefined}
            required
          />
        </Field>

        <Field
          id="expected_on"
          label="Fecha esperada (opcional)"
          errors={errors?.expected_on}
        >
          <div className="flex gap-1">
            <DatePicker
              id="expected_on"
              value={expectedOn}
              onChange={setExpectedOn}
              allowFuture
              className="flex-1"
            />
            {expectedOn && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar fecha esperada"
                onClick={() => setExpectedOn("")}
              >
                <X />
              </Button>
            )}
          </div>
        </Field>
      </div>

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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </DialogFooter>
    </form>
  )
}
