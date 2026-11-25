"use client"

import { useId, useState } from "react"
import { X } from "lucide-react"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldLabel } from "@/components/forms/field-label"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { formatDate, formatMonthLong, formatNumber } from "@/libs/format"
import type { Debt } from "../queries"
import { monthlyReceivablePreview } from "../receivable-schedule"
import type { DebtFormState } from "../types"

type TermMode = "open" | "fixed"

const TERM_OPTIONS = [
  { value: "open", label: "Sin fin" },
  { value: "fixed", label: "Con cuotas" }
] as const satisfies readonly { value: TermMode; label: string }[]

interface ReceivableDialogFieldsProps {
  receivable?: Debt
  errors: DebtFormState["fieldErrors"]
  values: DebtFormState["values"]
}

/** Cobro único: saldo y fecha esperada (SPEC 06) */
export function ReceivableDialogOnceFields({
  receivable,
  errors,
  values
}: ReceivableDialogFieldsProps) {
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

/**
 * Cobro mes a mes (SPEC 28): cuota fija, día de pago, inicio y número de
 * cuotas opcional (vacío = indefinida)
 */
export function ReceivableDialogMonthlyFields({
  receivable,
  errors,
  values
}: ReceivableDialogFieldsProps) {
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
  const preview = monthlyReceivablePreview({ amount, dueDay, startsOn, term })

  if (!preview) {
    return (
      <p className="rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
        Completa el monto y el día de pago para ver el resumen.
      </p>
    )
  }

  const { day, firstDue, end } = preview

  return (
    <div
      className="flex flex-col gap-1 rounded-2xl bg-subtle p-3 text-sm"
      aria-live="polite"
    >
      <p>
        <span className="font-medium tabular-nums">
          {formatNumber(amount, { maximumFractionDigits: 2 })}
        </span>{" "}
        cada mes, el día {day}. Primera cuota el{" "}
        <span className="font-medium">{formatDate(firstDue)}</span>.
      </p>
      <p className="text-muted-foreground">
        {end === null ? (
          "Sin fecha de fin: sigue hasta que la archives."
        ) : (
          <>
            {end.months} {end.months === 1 ? "cuota" : "cuotas"}, la última en{" "}
            {formatMonthLong(end.lastPeriod.slice(0, 7))}. Total{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(end.total, { maximumFractionDigits: 2 })}
            </span>
            .
          </>
        )}
        {day > 28 && " Los meses más cortos vencen el último día."}
      </p>
    </div>
  )
}
