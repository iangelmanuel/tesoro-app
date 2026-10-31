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
import { X } from "lucide-react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { createDebt, updateDebt } from "../actions"
import type { Debt } from "../queries"
import type { DebtFormState } from "../types"
import { amountInput } from "./field"

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
              <Modal.Heading>
                {isEditing
                  ? "Editar cuenta por cobrar"
                  : "Nueva cuenta por cobrar"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de la cuenta por cobrar. Sus abonos y ajustes no cambian."
                  : "Dinero que prestaste o que alguien te debe."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <ReceivableForm
                receivable={receivable}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          maxLength={60}
          defaultValue={values?.name ?? receivable?.name}
          isRequired
          isInvalid={Boolean(errors?.name)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Nombre</Label>
          <Input placeholder="Préstamo a Juan" />
          <FieldError>{errors?.name?.[0]}</FieldError>
        </TextField>

        <TextField
          name="counterparty"
          maxLength={60}
          defaultValue={values?.counterparty ?? receivable?.counterparty ?? ""}
          isInvalid={Boolean(errors?.counterparty)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Deudor (opcional)</Label>
          <Input placeholder="Juan" />
          <FieldError>{errors?.counterparty?.[0]}</FieldError>
        </TextField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="opening_balance"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.opening_balance ?? amountInput(receivable?.opening_balance)
          }
          isRequired
          isInvalid={Boolean(errors?.opening_balance)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>{isEditing ? "Monto inicial" : "Monto que te deben"}</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.opening_balance?.[0]}</FieldError>
        </TextField>

        <div className="flex items-end gap-1">
          <DatePickerField
            name="expected_on"
            label="Fecha esperada (opcional)"
            value={expectedOn}
            onChange={setExpectedOn}
            error={errors?.expected_on?.[0]}
            className="flex flex-1 flex-col gap-2"
          />
          {expectedOn && (
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Quitar fecha esperada"
              onPress={() => setExpectedOn("")}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
