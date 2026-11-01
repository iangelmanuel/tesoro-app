"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast
} from "@heroui/react"
import { X } from "lucide-react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { createRecurringExpense, updateRecurringExpense } from "../actions"
import { monthName } from "../occurrences"
import type { RecurringExpense } from "../queries"
import type { RecurringFrequency } from "../schemas"
import type { RecurringExpenseFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

interface RecurringExpenseDialogProps {
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Si llega, el diálogo edita este gasto fijo */
  expense?: RecurringExpense
  /** Botón que abre el diálogo */
  trigger: React.ReactNode
}

export function RecurringExpenseDialog({
  categories,
  expense,
  trigger
}: RecurringExpenseDialogProps) {
  const [open, setOpen] = useState(false)
  const isEditing = expense !== undefined

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
                {isEditing ? "Editar gasto fijo" : "Nuevo gasto fijo"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos del gasto fijo."
                  : "Un pago que se repite cada mes o cada año, como el arriendo o una suscripción."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <RecurringExpenseForm
                categories={categories}
                expense={expense}
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

interface RecurringExpenseFormProps {
  categories: Category[]
  expense?: RecurringExpense
  onSaved: () => void
  onCancel: () => void
}

function RecurringExpenseForm({
  categories,
  expense,
  onSaved,
  onCancel
}: RecurringExpenseFormProps) {
  const isEditing = expense !== undefined
  // Solo se aceptan categorías de gasto activas
  const options = categories.filter(
    (category) => category.type === "expense" && category.archived_at === null
  )
  const currentCategoryArchived =
    expense !== undefined && expense.category.archived_at !== null

  const [frequency, setFrequency] = useState<RecurringFrequency>(
    expense?.frequency ?? "monthly"
  )
  const [categoryId, setCategoryId] = useState(
    currentCategoryArchived ? "" : (expense?.category_id ?? "")
  )
  const [monthOfYear, setMonthOfYear] = useState(
    expense?.month_of_year ? String(expense.month_of_year) : ""
  )
  const [startsOn, setStartsOn] = useState(
    () => expense?.starts_on ?? todayISO()
  )
  const [endsOn, setEndsOn] = useState(expense?.ends_on ?? "")

  const [state, formAction, pending] = useActionState<
    RecurringExpenseFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateRecurringExpense(prevState, formData)
      : await createRecurringExpense(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing ? "Gasto fijo actualizado" : "Gasto fijo registrado"
      )
      onSaved()
    }
    return result
  }, {})

  function handleFrequencyChange(keys: Set<React.Key>) {
    const [value] = [...keys]
    if (!value || value === frequency) return
    setFrequency(value as RecurringFrequency)
  }

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
          value={expense.id}
        />
      )}
      <input
        type="hidden"
        name="frequency"
        value={frequency}
      />

      <TextField
        name="name"
        maxLength={60}
        defaultValue={values?.name ?? expense?.name}
        isRequired
        isInvalid={Boolean(errors?.name)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input placeholder="Arriendo" />
        <FieldError>{errors?.name?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.amount ??
            (expense ? AMOUNT_FORMAT.format(expense.amount) : "")
          }
          isRequired
          isInvalid={Boolean(errors?.amount)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Monto</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.amount?.[0]}</FieldError>
        </TextField>

        <Select
          name="category_id"
          fullWidth
          placeholder="Elige una categoría"
          value={categoryId || null}
          onChange={(key) => setCategoryId(key == null ? "" : String(key))}
          isInvalid={Boolean(errors?.category_id)}
          className="flex flex-col gap-2"
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {options.map((category) => (
                <ListBox.Item
                  key={category.id}
                  id={category.id}
                  textValue={category.name}
                >
                  <CategoryBadge
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                  />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.category_id?.[0]}</FieldError>
          {currentCategoryArchived && !categoryId && (
            <p className="text-sm text-muted">
              La categoría de este gasto fijo está archivada. Elige otra.
            </p>
          )}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="frequency-label">Frecuencia</Label>
        <ToggleButtonGroup
          aria-labelledby="frequency-label"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[frequency]}
          onSelectionChange={handleFrequencyChange}
          fullWidth
        >
          <ToggleButton
            id="monthly"
            className="flex-1"
          >
            Mensual
          </ToggleButton>
          <ToggleButton
            id="yearly"
            className="flex-1"
          >
            Anual
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="day_of_month"
          inputMode="numeric"
          defaultValue={
            values?.day_of_month ??
            (expense ? String(expense.day_of_month) : undefined)
          }
          isRequired
          isInvalid={Boolean(errors?.day_of_month)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Día de pago</Label>
          <Input
            type="number"
            min={1}
            max={31}
            placeholder="5"
          />
          <FieldError>{errors?.day_of_month?.[0]}</FieldError>
        </TextField>

        {/* El mes de pago solo aplica a los anuales */}
        {frequency === "yearly" && (
          <Select
            name="month_of_year"
            fullWidth
            placeholder="Elige un mes"
            value={monthOfYear || null}
            onChange={(key) => setMonthOfYear(key == null ? "" : String(key))}
            isInvalid={Boolean(errors?.month_of_year)}
            className="flex flex-col gap-2"
          >
            <Label>Mes de pago</Label>
            <Select.Trigger className="capitalize">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {MONTHS.map((month) => (
                  <ListBox.Item
                    key={month}
                    id={String(month)}
                    textValue={monthName(month)}
                    className="capitalize"
                  >
                    {monthName(month)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError>{errors?.month_of_year?.[0]}</FieldError>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerField
          name="starts_on"
          label="Desde"
          value={startsOn}
          onChange={setStartsOn}
          error={errors?.starts_on?.[0]}
          isRequired
        />

        <div className="flex items-end gap-1">
          <DatePickerField
            name="ends_on"
            label="Hasta (opcional)"
            value={endsOn}
            onChange={setEndsOn}
            error={errors?.ends_on?.[0]}
            className="flex flex-1 flex-col gap-2"
          />
          {endsOn && (
            <Button
              variant="ghost"
              isIconOnly
              aria-label="Quitar fecha de fin"
              onPress={() => setEndsOn("")}
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
