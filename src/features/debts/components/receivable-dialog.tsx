"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast
} from "@heroui/react"
import { X } from "lucide-react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
import { createDebt, updateDebt } from "../actions"
import { formatMonthYear } from "../calculations"
import type { Debt } from "../queries"
import {
  installmentDueOn,
  lastPeriodOn,
  periodOf
} from "../receivable-schedule"
import type { ReceivableSchedule } from "../schemas"
import type { DebtFormState } from "../types"
import { amountInput } from "./field"

interface ReceivableDialogProps {
  /** Si llega, el diálogo edita esta cuenta por cobrar */
  receivable?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReceivableDialog({
  receivable,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = receivable !== undefined

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
                {isEditing
                  ? "Editar cuenta por cobrar"
                  : "Nueva cuenta por cobrar"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de la cuenta por cobrar. Sus abonos y ajustes no cambian."
                  : "Dinero que prestaste, que alguien te debe o que te pagan cada mes."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <ReceivableForm
                receivable={receivable}
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

interface ReceivableFormProps {
  receivable?: Debt
  onSaved: () => void
  onCancel: () => void
}

function ReceivableForm({
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
          <Tabs
            selectedKey={schedule}
            onSelectionChange={(key) => setSchedule(key as ReceivableSchedule)}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Tipo de cobro">
                <Tabs.Tab id="once">
                  Una vez
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="monthly">
                  Mes a mes
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          maxLength={60}
          defaultValue={values?.name ?? receivable?.name}
          isRequired
          isInvalid={Boolean(errors?.name)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Nombre</Label>
          <Input
            placeholder={
              schedule === "monthly" ? "Arriendo" : "Préstamo a Juan"
            }
          />
          <FieldError>{errors?.name?.[0]}</FieldError>
        </TextField>

        <TextField
          name="counterparty"
          maxLength={60}
          defaultValue={values?.counterparty ?? receivable?.counterparty ?? ""}
          isInvalid={Boolean(errors?.counterparty)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Deudor (opcional)</Label>
          <Input placeholder="Juan" />
          <FieldError>{errors?.counterparty?.[0]}</FieldError>
        </TextField>
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
      <TextField
        name="opening_balance"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={
          values?.opening_balance ?? amountInput(receivable?.opening_balance)
        }
        isRequired
        isInvalid={Boolean(errors?.opening_balance)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>{isEditing ? "Monto inicial" : "Monto que te deben"}</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.opening_balance?.[0]}</FieldError>
      </TextField>

      <div className="flex items-end gap-1">
        <DatePickerField
          name="expected_on"
          label="Fecha esperada (opcional)"
          value={expectedOn}
          onChange={setExpectedOn}
          error={errors?.expected_on?.[0]}
          className="flex flex-1 flex-col gap-2"
        />
        {expectedOn && (
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Quitar fecha esperada"
            onPress={() => setExpectedOn("")}
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

  return (
    <>
      <input
        type="hidden"
        name="term_months"
        value={isFixed ? termText : ""}
      />

      <TextField
        name="installment"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={setAmountText}
        isRequired
        isInvalid={Boolean(errors?.installment)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Monto mensual</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.installment?.[0]}</FieldError>
      </TextField>

      {/* La fecha se lleva el ancho; el día de pago solo necesita dos cifras */}
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-start gap-4">
        <DatePickerField
          name="starts_on"
          label="Desde"
          value={startsOn}
          onChange={setStartsOn}
          error={errors?.starts_on?.[0]}
          isRequired
          className="flex min-w-0 flex-col gap-2"
        />

        <TextField
          name="due_day"
          inputMode="numeric"
          value={dueDay}
          onChange={setDueDay}
          isRequired
          isInvalid={Boolean(errors?.due_day)}
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
          <FieldError>{errors?.due_day?.[0]}</FieldError>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <Label id="receivable-term-label">Duración</Label>
        <div className="flex items-center gap-2">
          <ToggleButtonGroup
            aria-labelledby="receivable-term-label"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[termMode]}
            onSelectionChange={(keys) => {
              const [value] = [...keys]
              if (value) setTermMode(value as TermMode)
            }}
            className="min-w-0 flex-1"
            fullWidth
          >
            <ToggleButton
              id="open"
              className="flex-1"
            >
              Sin fin
            </ToggleButton>
            <ToggleButton
              id="fixed"
              className="flex-1"
            >
              Con cuotas
            </ToggleButton>
          </ToggleButtonGroup>
          {isFixed && (
            <TextField
              aria-label="Número de cuotas"
              inputMode="numeric"
              value={termText}
              onChange={setTermText}
              isInvalid={Boolean(errors?.term_months)}
              validationBehavior="aria"
              className="w-24 shrink-0"
            >
              <Input
                type="number"
                min={1}
                max={600}
                placeholder="12"
              />
            </TextField>
          )}
        </div>
        {errors?.term_months && (
          <p className="text-sm text-danger">{errors.term_months[0]}</p>
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
      <p className="rounded-lg bg-default p-3 text-sm text-muted">
        Completa el monto y el día de pago para ver el resumen.
      </p>
    )
  }

  const firstPeriod = periodOf(startsOn)
  const firstDue = installmentDueOn(firstPeriod, day)
  const last =
    months === null
      ? null
      : lastPeriodOn({ starts_on: startsOn, due_day: day, term_months: months })

  return (
    <div
      className="flex flex-col gap-1 rounded-lg bg-default p-3 text-sm"
      aria-live="polite"
    >
      <p>
        <span className="font-medium tabular-nums">
          {NUMBER_FORMAT.format(amount)}
        </span>{" "}
        cada mes, el día {day}. Primera cuota el{" "}
        <span className="font-medium">{formatDate(firstDue)}</span>.
      </p>
      <p className="text-muted">
        {months === null || last === null ? (
          "Sin fecha de fin: sigue hasta que la archives."
        ) : (
          <>
            {months} {months === 1 ? "cuota" : "cuotas"}, la última en{" "}
            {formatMonthYear(last.slice(0, 7))}. Total{" "}
            <span className="font-medium text-foreground tabular-nums">
              {NUMBER_FORMAT.format(Math.round(amount * months * 100) / 100)}
            </span>
            .
          </>
        )}
        {day > 28 && " Los meses más cortos vencen el último día."}
      </p>
    </div>
  )
}
