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
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createDebt, updateDebt } from "../actions"
import type { Debt } from "../queries"
import type { RateType } from "../schemas"
import type { DebtFormState } from "../types"
import { Field, amountInput, rateInput } from "./field"

type PayableKind = "credit_card" | "loan"

interface DebtDialogProps {
  /** Si llega, el diálogo edita esta tarjeta o préstamo */
  debt?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DebtDialog({
  debt,
  trigger,
  open: controlledOpen,
  onOpenChange
}: DebtDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = debt !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar deuda" : "Nueva deuda"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos de la deuda. Sus pagos y ajustes no cambian."
              : "Una tarjeta de crédito o un préstamo que estás pagando."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <DebtForm
          debt={debt}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface DebtFormProps {
  debt?: Debt
  onSaved: () => void
  onCancel: () => void
}

function DebtForm({ debt, onSaved, onCancel }: DebtFormProps) {
  const isEditing = debt !== undefined

  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateDebt(prevState, formData)
        : await createDebt(prevState, formData)

      if (result.ok) {
        toast.success(isEditing ? "Deuda actualizada" : "Deuda creada")
        onSaved()
      }
      return result
    },
    {}
  )

  const errors = state.fieldErrors
  const values = state.values

  // El tipo solo se elige al crear
  const [kind, setKind] = useState<PayableKind>(
    debt?.kind === "loan" || values?.kind === "loan" ? "loan" : "credit_card"
  )
  const [rateType, setRateType] = useState<RateType>(
    (values?.rate_type as RateType | undefined) || debt?.rate_type || "ea"
  )
  const isCard = kind === "credit_card"

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
          value={debt.id}
        />
      ) : (
        <input
          type="hidden"
          name="kind"
          value={kind}
        />
      )}
      <input
        type="hidden"
        name="rate_type"
        value={rateType}
      />

      {!isEditing && (
        <div className="flex flex-col gap-2">
          <Label>Tipo</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={kind}
            onValueChange={(value) => value && setKind(value as PayableKind)}
            className="w-full"
            aria-label="Tipo de deuda"
          >
            <ToggleGroupItem
              value="credit_card"
              className="flex-1"
            >
              Tarjeta de crédito
            </ToggleGroupItem>
            <ToggleGroupItem
              value="loan"
              className="flex-1"
            >
              Préstamo
            </ToggleGroupItem>
          </ToggleGroup>
          {errors?.kind && (
            <p className="text-sm text-destructive">{errors.kind[0]}</p>
          )}
        </div>
      )}

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
            placeholder={isCard ? "Visa" : "Crédito de vehículo"}
            defaultValue={values?.name ?? debt?.name}
            aria-invalid={Boolean(errors?.name) || undefined}
            required
          />
        </Field>

        <Field
          id="counterparty"
          label="Entidad (opcional)"
          errors={errors?.counterparty}
        >
          <Input
            id="counterparty"
            name="counterparty"
            maxLength={60}
            placeholder="Banco"
            defaultValue={values?.counterparty ?? debt?.counterparty ?? ""}
            aria-invalid={Boolean(errors?.counterparty) || undefined}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          id="opening_balance"
          label={isEditing ? "Saldo inicial" : "Saldo actual"}
          errors={errors?.opening_balance}
          defaultValue={
            values?.opening_balance ?? amountInput(debt?.opening_balance)
          }
          required
        />

        {isCard ? (
          <AmountField
            id="credit_limit"
            label="Cupo"
            errors={errors?.credit_limit}
            defaultValue={
              values?.credit_limit ?? amountInput(debt?.credit_limit)
            }
            required
          />
        ) : (
          <AmountField
            id="installment"
            label="Cuota mensual"
            errors={errors?.installment}
            defaultValue={values?.installment ?? amountInput(debt?.installment)}
            required
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="interest_rate"
          label={isCard ? "Tasa de interés (opcional)" : "Tasa de interés"}
          errors={errors?.interest_rate ?? errors?.rate_type}
        >
          <div className="flex gap-2">
            <Input
              id="interest_rate"
              name="interest_rate"
              inputMode="decimal"
              autoComplete="off"
              placeholder={isCard ? "28,5" : "0 si no tiene"}
              defaultValue={
                values?.interest_rate ?? rateInput(debt?.interest_rate)
              }
              aria-invalid={Boolean(errors?.interest_rate) || undefined}
              required={!isCard}
            />
            <ToggleGroup
              type="single"
              variant="outline"
              value={rateType}
              onValueChange={(value) => value && setRateType(value as RateType)}
              aria-label="Tipo de tasa"
            >
              <ToggleGroupItem value="ea">E.A.</ToggleGroupItem>
              <ToggleGroupItem value="mv">M.V.</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </Field>

        <DayField
          id="due_day"
          label="Día de pago"
          errors={errors?.due_day}
          defaultValue={values?.due_day ?? debt?.due_day ?? undefined}
          required
        />
      </div>

      {isCard ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <AmountField
            id="min_payment"
            label="Pago mínimo (opcional)"
            errors={errors?.min_payment}
            defaultValue={values?.min_payment ?? amountInput(debt?.min_payment)}
          />
          <DayField
            id="closing_day"
            label="Día de corte (opcional)"
            errors={errors?.closing_day}
            defaultValue={values?.closing_day ?? debt?.closing_day ?? undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AmountField
            id="original_amount"
            label="Monto original (opcional)"
            errors={errors?.original_amount}
            defaultValue={
              values?.original_amount ?? amountInput(debt?.original_amount)
            }
          />
          <Field
            id="term_months"
            label="Plazo en meses (opcional)"
            errors={errors?.term_months}
          >
            <Input
              id="term_months"
              name="term_months"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              placeholder="36"
              defaultValue={
                values?.term_months ?? debt?.term_months ?? undefined
              }
              aria-invalid={Boolean(errors?.term_months) || undefined}
            />
          </Field>
        </div>
      )}

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

function AmountField({
  id,
  label,
  errors,
  defaultValue,
  required
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue: string
  required?: boolean
}) {
  return (
    <Field
      id={id}
      label={label}
      errors={errors}
    >
      <Input
        id={id}
        name={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors) || undefined}
        required={required}
      />
    </Field>
  )
}

function DayField({
  id,
  label,
  errors,
  defaultValue,
  required
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue?: string | number
  required?: boolean
}) {
  return (
    <Field
      id={id}
      label={label}
      errors={errors}
    >
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={31}
        placeholder="15"
        defaultValue={defaultValue}
        aria-invalid={Boolean(errors) || undefined}
        required={required}
      />
    </Field>
  )
}
