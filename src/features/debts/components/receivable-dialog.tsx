"use client"

import { useActionState, useId, useState } from "react"
import { X } from "lucide-react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp, FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import { parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { formatDate, formatMonthLong } from "@/libs/format"
import { roundCents } from "@/libs/money"
import { createDebt, updateDebt } from "../debt-actions"
import type { Debt } from "../queries"
import {
  installmentDueOn,
  lastPeriodOn,
  periodOf
} from "../receivable-schedule"
import type { ReceivableSchedule } from "../receivable-schemas"
import type { DebtFormState } from "../types"

const SCHEDULE_OPTIONS = [
  { value: "once", label: "Una vez" },
  { value: "monthly", label: "Mes a mes" }
] as const satisfies readonly { value: ReceivableSchedule; label: string }[]

const TERM_OPTIONS = [
  { value: "open", label: "Sin fin" },
  { value: "fixed", label: "Con cuotas" }
] as const satisfies readonly { value: TermMode; label: string }[]

interface ReceivableDialogProps {
  /** Espacio (para crear una cuenta desde el select) */
  workspaceId: string
  /** Cuentas del espacio (cuenta por defecto); solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita esta cuenta por cobrar */
  receivable?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReceivableDialog({
  workspaceId,
  accounts,
  receivable,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableDialogProps) {
  const isEditing = receivable !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar cuenta por cobrar" : "Nueva cuenta por cobrar"}
      description={
        isEditing
          ? "Cambia los datos de la cuenta por cobrar. Sus abonos y ajustes no cambian."
          : "Dinero que prestaste, que alguien te debe o que te pagan cada mes."
      }
    >
      {(close) => (
        <ReceivableForm
          workspaceId={workspaceId}
          accounts={accounts}
          receivable={receivable}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface ReceivableFormProps {
  workspaceId: string
  accounts: AccountOption[]
  receivable?: Debt
  onSaved: () => void
  onCancel: () => void
}

function ReceivableForm({
  workspaceId,
  accounts,
  receivable,
  onSaved,
  onCancel
}: ReceivableFormProps) {
  const isEditing = receivable !== undefined
  // El tipo de cobro se elige al crear (SPEC 28); al editar se usa el
  // guardado y no se puede cambiar
  const [schedule, setSchedule] = useState<ReceivableSchedule>(
    receivable?.schedule ?? "once"
  )
  // Cuenta por defecto (SPEC 41): la que recibe los cobros. Solo activas; una
  // archivada se vacía
  const accountOptions = selectableAccounts(accounts)
  const [accountId, setAccountId] = useState(() =>
    accountOptions.some((account) => account.id === receivable?.account_id)
      ? (receivable?.account_id ?? "")
      : ""
  )

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
        <>
          <input
            type="hidden"
            name="kind"
            value="receivable"
          />
          <input
            type="hidden"
            name="schedule"
            value={schedule}
          />
          <div className="flex items-center gap-1">
            <ToggleGroup
              value={[schedule]}
              onValueChange={(next) => {
                const [value] = next
                if (value) setSchedule(value as ReceivableSchedule)
              }}
              aria-label="Tipo de cobro"
              spacing={1}
              className={SEGMENT_TRACK_CLASS}
            >
              {SCHEDULE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={SEGMENT_ITEM_CLASS}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldHelp
              help="receivable.mode"
              label="Tipo de cobro"
            />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="name"
          label="Nombre"
          help="receivable.name"
          maxLength={60}
          placeholder={schedule === "monthly" ? "Arriendo" : "Préstamo a Juan"}
          defaultValue={values?.name ?? receivable?.name}
          isRequired
          error={errors?.name?.[0]}
        />

        <TextInputField
          name="counterparty"
          label="Deudor (opcional)"
          help="receivable.debtor"
          maxLength={60}
          placeholder="Juan"
          defaultValue={values?.counterparty ?? receivable?.counterparty ?? ""}
          error={errors?.counterparty?.[0]}
        />
      </div>

      {schedule === "monthly" ? (
        <MonthlyFields
          receivable={receivable}
          errors={errors}
          values={values}
        />
      ) : (
        <OnceFields
          receivable={receivable}
          errors={errors}
          values={values}
        />
      )}

      <AccountSelectField
        name="account_id"
        label="Cuenta por defecto (opcional)"
        help="common.defaultAccount"
        value={accountId}
        onChange={setAccountId}
        accounts={accountOptions}
        workspaceId={workspaceId}
        allowNone
        error={errors?.account_id?.[0]}
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

interface FieldsProps {
  receivable?: Debt
  errors: DebtFormState["fieldErrors"]
  values: DebtFormState["values"]
}

// Cobro único: saldo y fecha esperada (SPEC 06)
function OnceFields({ receivable, errors, values }: FieldsProps) {
  const isEditing = receivable !== undefined
  const [expectedOn, setExpectedOn] = useState(
    values?.expected_on ?? receivable?.expected_on ?? ""
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInputField
        name="opening_balance"
        label={isEditing ? "Monto inicial" : "Monto que te deben"}
        help="receivable.amount"
        helpLabel="Monto"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={
          values?.opening_balance ?? amountInput(receivable?.opening_balance)
        }
        isRequired
        error={errors?.opening_balance?.[0]}
      />

      <div className="flex items-end gap-1">
        <DatePickerField
          name="expected_on"
          label="Fecha esperada (opcional)"
          help="receivable.expectedDate"
          value={expectedOn}
          onChange={setExpectedOn}
          error={errors?.expected_on?.[0]}
          className="flex flex-1 flex-col gap-2"
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
    </div>
  )
}

// Cobro mes a mes (SPEC 28): cuota fija, día de pago, inicio y número de
// cuotas opcional (vacío = indefinida)
function MonthlyFields({ receivable, errors, values }: FieldsProps) {
  const savedTerm =
    receivable?.term_months != null ? String(receivable.term_months) : ""
  const [amountText, setAmountText] = useState(
    values?.installment ?? amountInput(receivable?.installment)
  )
  const [dueDay, setDueDay] = useState(
    values?.due_day ??
      (receivable?.due_day != null ? String(receivable.due_day) : "")
  )
  const [startsOn, setStartsOn] = useState(
    values?.starts_on ?? receivable?.starts_on ?? todayISO()
  )
  // Duración: sin fin (indefinida) o con número de cuotas
  const [termMode, setTermMode] = useState<TermMode>(() =>
    (values ? values.term_months : savedTerm) ? "fixed" : "open"
  )
  const [termText, setTermText] = useState(
    values?.term_months || savedTerm || "12"
  )
  const isFixed = termMode === "fixed"
  const termId = useId()
  const termLabelId = `${termId}-label`
  const termErrorId = `${termId}-error`

  return (
    <>
      <input
        type="hidden"
        name="term_months"
        value={isFixed ? termText : ""}
      />

      <TextInputField
        name="installment"
        label="Monto mensual"
        help="receivable.monthlyAmount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amountText}
        onChange={(event) => setAmountText(event.target.value)}
        isRequired
        error={errors?.installment?.[0]}
      />

      {/* La fecha se lleva el ancho; el día de pago solo necesita dos cifras */}
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-start gap-4">
        <DatePickerField
          name="starts_on"
          label="Desde"
          help="common.from"
          value={startsOn}
          onChange={setStartsOn}
          error={errors?.starts_on?.[0]}
          isRequired
          className="flex min-w-0 flex-col gap-2"
        />

        <TextInputField
          name="due_day"
          label="Día de pago"
          help="receivable.dueDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          placeholder="5"
          value={dueDay}
          onChange={(event) => setDueDay(event.target.value)}
          isRequired
          error={errors?.due_day?.[0]}
        />
      </div>

      <div
        className="flex flex-col gap-2"
        data-invalid={errors?.term_months ? true : undefined}
      >
        <FieldLabel
          id={termLabelId}
          help="receivable.installments"
          isInvalid={Boolean(errors?.term_months)}
        >
          Duración
        </FieldLabel>
        <div className="flex items-center gap-2">
          <ToggleGroup
            value={[termMode]}
            onValueChange={(next) => {
              const [value] = next
              if (value) setTermMode(value as TermMode)
            }}
            aria-labelledby={termLabelId}
            spacing={1}
            className={SEGMENT_TRACK_CLASS}
          >
            {TERM_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className={SEGMENT_ITEM_CLASS}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {isFixed && (
            <Input
              aria-label="Número de cuotas"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              placeholder="12"
              value={termText}
              onChange={(event) => setTermText(event.target.value)}
              aria-invalid={errors?.term_months ? true : undefined}
              aria-describedby={errors?.term_months ? termErrorId : undefined}
              className="w-24 shrink-0"
            />
          )}
        </div>
        {errors?.term_months && (
          <FieldError id={termErrorId}>{errors.term_months[0]}</FieldError>
        )}
      </div>

      <MonthlySummary
        amountText={amountText}
        dueDay={dueDay}
        startsOn={startsOn}
        term={isFixed ? termText : null}
      />
    </>
  )
}

type TermMode = "open" | "fixed"

const NUMBER_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

/**
 * Lo que va a pasar, en una frase: cuánto, desde cuándo, hasta cuándo y el
 * total. Se actualiza mientras el usuario escribe.
 */
function MonthlySummary({
  amountText,
  dueDay,
  startsOn,
  term
}: {
  amountText: string
  dueDay: string
  startsOn: string
  /** Número de cuotas como texto, o null si es sin fin */
  term: string | null
}) {
  const amount = parseAmount(amountText)
  const day = Number(dueDay)
  const months = term === null ? null : Number(term)
  const ready =
    !Number.isNaN(amount) &&
    amount > 0 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 31 &&
    startsOn !== "" &&
    (months === null ||
      (Number.isInteger(months) && months >= 1 && months <= 600))

  if (!ready) {
    return (
      <p className="rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
        Completa el monto y el día de pago para ver el resumen.
      </p>
    )
  }

  const firstPeriod = periodOf(startsOn)
  const firstDue = installmentDueOn(firstPeriod, day)
  const last =
    months === null
      ? null
      : lastPeriodOn({ starts_on: startsOn, term_months: months })

  return (
    <div
      className="flex flex-col gap-1 rounded-2xl bg-subtle p-3 text-sm"
      aria-live="polite"
    >
      <p>
        <span className="font-medium tabular-nums">
          {NUMBER_FORMAT.format(amount)}
        </span>{" "}
        cada mes, el día {day}. Primera cuota el{" "}
        <span className="font-medium">{formatDate(firstDue)}</span>.
      </p>
      <p className="text-muted-foreground">
        {months === null || last === null ? (
          "Sin fecha de fin: sigue hasta que la archives."
        ) : (
          <>
            {months} {months === 1 ? "cuota" : "cuotas"}, la última en{" "}
            {formatMonthLong(last.slice(0, 7))}. Total{" "}
            <span className="font-medium text-foreground tabular-nums">
              {NUMBER_FORMAT.format(roundCents(amount * months))}
            </span>
            .
          </>
        )}
        {day > 28 && " Los meses más cortos vencen el último día."}
      </p>
    </div>
  )
}
