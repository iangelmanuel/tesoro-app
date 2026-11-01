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
import { parseDate } from "@internationalized/date"
import { X } from "lucide-react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { todayISO } from "@/libs/dates"
import { createGoal, updateGoal } from "../actions"
import type { Goal } from "../queries"
import type { GoalFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

interface GoalDialogProps {
  /** Si llega, el diálogo edita esta meta */
  goal?: Goal
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GoalDialog({
  goal,
  trigger,
  open: controlledOpen,
  onOpenChange
}: GoalDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = goal !== undefined

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
                {isEditing ? "Editar meta" : "Nueva meta"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de la meta. Sus aportes no cambian."
                  : "Algo para lo que quieres ahorrar, como un viaje o un fondo de emergencia."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <GoalForm
                goal={goal}
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

interface GoalFormProps {
  goal?: Goal
  onSaved: () => void
  onCancel: () => void
}

function GoalForm({ goal, onSaved, onCancel }: GoalFormProps) {
  const isEditing = goal !== undefined
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "")

  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateGoal(prevState, formData)
        : await createGoal(prevState, formData)

      if (result.ok) {
        toast.success(isEditing ? "Meta actualizada" : "Meta creada")
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
      {isEditing && (
        <input
          type="hidden"
          name="id"
          value={goal.id}
        />
      )}

      <TextField
        name="name"
        maxLength={60}
        defaultValue={values?.name ?? goal?.name}
        isRequired
        isInvalid={Boolean(errors?.name)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input placeholder="Viaje" />
        <FieldError>{errors?.name?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="target_amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.target_amount ??
            (goal ? AMOUNT_FORMAT.format(goal.target_amount) : "")
          }
          isRequired
          isInvalid={Boolean(errors?.target_amount)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Monto objetivo</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.target_amount?.[0]}</FieldError>
        </TextField>

        {/* Solo deja elegir fechas posteriores a hoy */}
        <div className="flex items-end gap-1">
          <DatePickerField
            name="target_date"
            label="Fecha objetivo (opcional)"
            value={targetDate}
            onChange={setTargetDate}
            error={errors?.target_date?.[0]}
            minValue={parseDate(todayISO()).add({ days: 1 }).toString()}
            className="flex flex-1 flex-col gap-2"
          />
          {targetDate && (
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Quitar fecha objetivo"
              onPress={() => setTargetDate("")}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      <IconColorPicker
        defaultIcon={values?.icon || goal?.icon}
        defaultColor={values?.color || goal?.color}
        iconErrors={errors?.icon}
        colorErrors={errors?.color}
      />

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
