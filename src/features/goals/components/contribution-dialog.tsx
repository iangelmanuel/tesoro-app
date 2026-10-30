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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { fromLocalDate, toLocalDate, todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
import { createContribution, updateContribution } from "../actions"
import type { GoalContribution } from "../queries"
import type { ContributionKind } from "../schemas"
import type { ContributionFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

const KIND_LABELS: Record<ContributionKind, string> = {
  deposit: "Aporte",
  withdrawal: "Retiro"
}

interface ContributionDialogProps {
  goalId: string
  /** Tipo inicial. Al editar se toma del signo del monto. */
  kind?: ContributionKind
  /** Si llega, el diálogo edita este aporte */
  contribution?: GoalContribution
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContributionDialog({
  goalId,
  kind = "deposit",
  contribution,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ContributionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = contribution !== undefined
  const initialKind: ContributionKind = contribution
    ? contribution.amount < 0
      ? "withdrawal"
      : "deposit"
    : kind

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? `Editar ${KIND_LABELS[initialKind].toLowerCase()}`
              : initialKind === "withdrawal"
                ? "Retirar de la meta"
                : "Aportar a la meta"}
          </DialogTitle>
          <DialogDescription>
            Los aportes no cambian tu balance ni tus movimientos.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <ContributionForm
          goalId={goalId}
          initialKind={initialKind}
          contribution={contribution}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface ContributionFormProps {
  goalId: string
  initialKind: ContributionKind
  contribution?: GoalContribution
  onSaved: () => void
  onCancel: () => void
}

function ContributionForm({
  goalId,
  initialKind,
  contribution,
  onSaved,
  onCancel
}: ContributionFormProps) {
  const isEditing = contribution !== undefined
  const [kind, setKind] = useState<ContributionKind>(initialKind)
  const [occurredOn, setOccurredOn] = useState(
    () => contribution?.occurred_on ?? todayISO()
  )

  const [state, formAction, pending] = useActionState<
    ContributionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateContribution(prevState, formData)
      : await createContribution(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing
          ? `${KIND_LABELS[kind]} actualizado`
          : `${KIND_LABELS[kind]} registrado`
      )
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
          value={contribution.id}
        />
      ) : (
        <input
          type="hidden"
          name="goal_id"
          value={goalId}
        />
      )}
      <input
        type="hidden"
        name="kind"
        value={kind}
      />
      <input
        type="hidden"
        name="occurred_on"
        value={occurredOn}
      />

      <div className="flex flex-col gap-2">
        <Label>Tipo</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(value) => value && setKind(value as ContributionKind)}
          className="w-full"
          aria-label="Tipo"
        >
          <ToggleGroupItem
            value="deposit"
            className="flex-1"
          >
            Aporte
          </ToggleGroupItem>
          <ToggleGroupItem
            value="withdrawal"
            className="flex-1"
          >
            Retiro
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

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
              (contribution
                ? AMOUNT_FORMAT.format(Math.abs(contribution.amount))
                : "")
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
          placeholder="Prima de diciembre"
          defaultValue={values?.note ?? contribution?.note ?? ""}
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

// Solo deja elegir fechas hasta hoy
function DatePicker({
  id,
  value,
  onChange
}: {
  id: string
  /** YYYY-MM-DD */
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = toLocalDate(value)

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
          className="justify-start font-normal"
        >
          <CalendarIcon data-icon="inline-start" />
          {formatDate(value)}
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
          disabled={(date) => fromLocalDate(date) > todayISO()}
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
