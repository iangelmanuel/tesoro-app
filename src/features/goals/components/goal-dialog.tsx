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
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { fromLocalDate, toLocalDate, todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos de la meta. Sus aportes no cambian."
              : "Algo para lo que quieres ahorrar, como un viaje o un fondo de emergencia."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <GoalForm
          goal={goal}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
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
      <input
        type="hidden"
        name="target_date"
        value={targetDate}
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
          placeholder="Viaje"
          defaultValue={values?.name ?? goal?.name}
          aria-invalid={Boolean(errors?.name) || undefined}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="target_amount"
          label="Monto objetivo"
          errors={errors?.target_amount}
        >
          <Input
            id="target_amount"
            name="target_amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            defaultValue={
              values?.target_amount ??
              (goal ? AMOUNT_FORMAT.format(goal.target_amount) : "")
            }
            aria-invalid={Boolean(errors?.target_amount) || undefined}
            required
          />
        </Field>

        <Field
          id="target_date"
          label="Fecha objetivo (opcional)"
          errors={errors?.target_date}
        >
          <div className="flex gap-1">
            <TargetDatePicker
              id="target_date"
              value={targetDate}
              onChange={setTargetDate}
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
        </Field>
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

// Solo deja elegir fechas posteriores a hoy
function TargetDatePicker({
  id,
  value,
  onChange
}: {
  id: string
  /** YYYY-MM-DD, o "" sin fecha */
  value: string
  onChange: (value: string) => void
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
            <span className="text-muted-foreground">Sin fecha</span>
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
          disabled={(date) => fromLocalDate(date) <= todayISO()}
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
