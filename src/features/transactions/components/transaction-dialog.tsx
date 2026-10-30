"use client"

import { useActionState, useState } from "react"
import { CalendarIcon } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
import { createTransaction, updateTransaction } from "../actions"
import type { TransactionType } from "../filters"
import type { TransactionWithCategory } from "../queries"
import type { TransactionFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

// YYYY-MM-DD ↔ Date local, sin pasar por UTC para no correr el día
function toDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

interface TransactionDialogProps {
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Si llega, el diálogo edita este movimiento */
  transaction?: TransactionWithCategory
  /** Botón que abre el diálogo */
  trigger: React.ReactNode
}

export function TransactionDialog({
  categories,
  transaction,
  trigger
}: TransactionDialogProps) {
  const [open, setOpen] = useState(false)
  const isEditing = transaction !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar movimiento" : "Nuevo movimiento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos del movimiento."
              : "Registra un ingreso o un gasto de tu espacio Personal."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <TransactionForm
          categories={categories}
          transaction={transaction}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface TransactionFormProps {
  categories: Category[]
  transaction?: TransactionWithCategory
  onSaved: () => void
  onCancel: () => void
}

function TransactionForm({
  categories,
  transaction,
  onSaved,
  onCancel
}: TransactionFormProps) {
  const isEditing = transaction !== undefined
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "expense"
  )
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "")
  const [date, setDate] = useState(() => transaction?.occurred_on ?? todayISO())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [state, formAction, pending] = useActionState<
    TransactionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateTransaction(prevState, formData)
      : await createTransaction(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing ? "Movimiento actualizado" : "Movimiento registrado"
      )
      onSaved()
    }
    return result
  }, {})

  // Solo activas del tipo elegido, más la actual del movimiento editado
  // aunque esté archivada, para poder guardar sin cambiarla
  const options = categories.filter(
    (category) =>
      category.type === type &&
      (category.archived_at === null ||
        category.id === transaction?.category_id)
  )

  function handleTypeChange(value: string) {
    if (!value || value === type) return
    setType(value as TransactionType)
    setCategoryId("")
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
          value={transaction.id}
        />
      )}
      <input
        type="hidden"
        name="type"
        value={type}
      />
      <input
        type="hidden"
        name="occurred_on"
        value={date}
      />

      <ToggleGroup
        type="single"
        variant="outline"
        value={type}
        onValueChange={handleTypeChange}
        className="w-full"
        aria-label="Tipo de movimiento"
      >
        <ToggleGroupItem
          value="expense"
          className="flex-1"
        >
          Gasto
        </ToggleGroupItem>
        <ToggleGroupItem
          value="income"
          className="flex-1"
        >
          Ingreso
        </ToggleGroupItem>
      </ToggleGroup>

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
              (transaction ? AMOUNT_FORMAT.format(transaction.amount) : "")
            }
            aria-invalid={Boolean(errors?.amount) || undefined}
            required
          />
        </Field>

        <Field
          id="occurred_on"
          label="Fecha"
          errors={errors?.occurred_on}
        >
          <Popover
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
          >
            <PopoverTrigger asChild>
              <Button
                id="occurred_on"
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon data-icon="inline-start" />
                {formatDate(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align="start"
            >
              <Calendar
                mode="single"
                locale={es}
                selected={toDate(date)}
                defaultMonth={toDate(date)}
                onSelect={(value) => {
                  if (value) {
                    setDate(toISODate(value))
                    setCalendarOpen(false)
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>

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
                  name={
                    category.archived_at
                      ? `${category.name} (archivada)`
                      : category.name
                  }
                  icon={category.icon}
                  color={category.color}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        id="description"
        label="Descripción"
        errors={errors?.description}
      >
        <Input
          id="description"
          name="description"
          maxLength={120}
          placeholder={type === "expense" ? "Mercado de la semana" : "Salario"}
          defaultValue={values?.description ?? transaction?.description}
          aria-invalid={Boolean(errors?.description) || undefined}
          required
        />
      </Field>

      <Field
        id="note"
        label="Nota (opcional)"
        errors={errors?.note}
      >
        <Textarea
          id="note"
          name="note"
          maxLength={500}
          rows={3}
          defaultValue={values?.note ?? transaction?.note ?? ""}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
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
