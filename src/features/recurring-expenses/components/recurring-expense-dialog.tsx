"use client"

import { useActionState, useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { es } from "react-day-picker/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { fromLocalDate, toLocalDate, todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar gasto fijo" : "Nuevo gasto fijo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos del gasto fijo."
              : "Un pago que se repite cada mes o cada año, como el arriendo o una suscripción."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <RecurringExpenseForm
          categories={categories}
          expense={expense}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
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

  function handleFrequencyChange(value: string) {
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
      <input
        type="hidden"
        name="starts_on"
        value={startsOn}
      />
      <input
        type="hidden"
        name="ends_on"
        value={endsOn}
      />

      <Field
        id="name"
        label="Nombre"
        errors={errors?.name}
      >
        <Input
          id="name"
          name="name"
          maxLength={60}
          placeholder="Arriendo"
          defaultValue={values?.name ?? expense?.name}
          aria-invalid={Boolean(errors?.name) || undefined}
          required
        />
      </Field>

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
            defaultValue={
              values?.amount ??
              (expense ? AMOUNT_FORMAT.format(expense.amount) : "")
            }
            aria-invalid={Boolean(errors?.amount) || undefined}
            required
          />
        </Field>

        <Field
          id="category_id"
          label="Categoría"
          errors={errors?.category_id}
        >
          <Select
            name="category_id"
            value={categoryId}
            onValueChange={setCategoryId}
          >
            <SelectTrigger
              id="category_id"
              className="w-full"
              aria-invalid={Boolean(errors?.category_id) || undefined}
            >
              <SelectValue placeholder="Elige una categoría" />
            </SelectTrigger>
            <SelectContent>
              {options.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                >
                  <CategoryBadge
                    name={category.name}
                    icon={category.icon}
                    color={category.color}
                  />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentCategoryArchived && !categoryId && (
            <p className="text-sm text-muted-foreground">
              La categoría de este gasto fijo está archivada. Elige otra.
            </p>
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Frecuencia</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={frequency}
          onValueChange={handleFrequencyChange}
          className="w-full"
          aria-label="Frecuencia"
        >
          <ToggleGroupItem
            value="monthly"
            className="flex-1"
          >
            Mensual
          </ToggleGroupItem>
          <ToggleGroupItem
            value="yearly"
            className="flex-1"
          >
            Anual
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="day_of_month"
          label="Día de pago"
          errors={errors?.day_of_month}
        >
          <Input
            id="day_of_month"
            name="day_of_month"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="5"
            defaultValue={
              values?.day_of_month ?? expense?.day_of_month ?? undefined
            }
            aria-invalid={Boolean(errors?.day_of_month) || undefined}
            required
          />
        </Field>

        {/* El mes de pago solo aplica a los anuales */}
        {frequency === "yearly" && (
          <Field
            id="month_of_year"
            label="Mes de pago"
            errors={errors?.month_of_year}
          >
            <Select
              name="month_of_year"
              value={monthOfYear}
              onValueChange={setMonthOfYear}
            >
              <SelectTrigger
                id="month_of_year"
                className="w-full capitalize"
                aria-invalid={Boolean(errors?.month_of_year) || undefined}
              >
                <SelectValue placeholder="Elige un mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem
                    key={month}
                    value={String(month)}
                    className="capitalize"
                  >
                    {monthName(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="starts_on"
          label="Desde"
          errors={errors?.starts_on}
        >
          <DatePicker
            id="starts_on"
            value={startsOn}
            onChange={setStartsOn}
          />
        </Field>

        <Field
          id="ends_on"
          label="Hasta (opcional)"
          errors={errors?.ends_on}
        >
          <div className="flex gap-1">
            <DatePicker
              id="ends_on"
              value={endsOn}
              onChange={setEndsOn}
              placeholder="Sin fecha de fin"
            />
            {endsOn && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar fecha de fin"
                onClick={() => setEndsOn("")}
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

function DatePicker({
  id,
  value,
  onChange,
  placeholder
}: {
  id: string
  /** YYYY-MM-DD, o "" sin fecha */
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? toLocalDate(value) : undefined

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="flex-1 justify-start font-normal"
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? (
            formatDate(value)
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
      >
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(fromLocalDate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function Field({
  id,
  label,
  errors,
  children
}: {
  id: string
  label: string
  errors?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {errors?.length ? (
        <p className="text-sm text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  )
}
