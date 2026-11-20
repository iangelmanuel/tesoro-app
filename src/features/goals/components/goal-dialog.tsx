"use client"

import { useActionState, useState } from "react"
import { X } from "lucide-react"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { fromLocalDate, toLocalDate, todayISO } from "@/libs/dates"
import { createGoal, updateGoal } from "../actions"
import type { Goal } from "../queries"
import type { GoalFormState } from "../types"

/** Mañana en YYYY-MM-DD: la fecha objetivo va después de hoy */
function tomorrowISO() {
  const date = toLocalDate(todayISO())
  date.setDate(date.getDate() + 1)
  return fromLocalDate(date)
}

interface GoalDialogProps {
  /** Si llega, el diálogo edita esta meta */
  goal?: Goal
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GoalDialog({
  goal,
  trigger,
  open: controlledOpen,
  onOpenChange
}: GoalDialogProps) {
  const isEditing = goal !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar meta" : "Nueva meta"}
      description={
        isEditing
          ? "Cambia los datos de la meta. Sus aportes no cambian."
          : "Algo para lo que quieres ahorrar, como un viaje o un fondo de emergencia."
      }
    >
      {(close) => (
        <GoalForm
          goal={goal}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
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

      <TextInputField
        name="name"
        label="Nombre"
        help="goal.name"
        maxLength={60}
        placeholder="Viaje"
        defaultValue={values?.name ?? goal?.name}
        isRequired
        error={errors?.name?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="target_amount"
          label="Monto objetivo"
          help="goal.target"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          defaultValue={
            values?.target_amount ?? amountInput(goal?.target_amount)
          }
          isRequired
          error={errors?.target_amount?.[0]}
        />

        {/* Solo deja elegir fechas posteriores a hoy */}
        <div className="flex items-end gap-1">
          <DatePickerField
            name="target_date"
            label="Fecha objetivo (opcional)"
            help="goal.targetDate"
            value={targetDate}
            onChange={setTargetDate}
            error={errors?.target_date?.[0]}
            minValue={tomorrowISO()}
            className="flex flex-1 flex-col gap-2"
          />
          {targetDate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar fecha objetivo"
              onClick={() => setTargetDate("")}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
