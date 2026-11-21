"use client"

import { useActionState, useState } from "react"
import { X } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { amountInput } from "@/components/forms/amount-format"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { monthName } from "@/features/recurring-expenses/occurrences"
import { parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { formatShortDate } from "@/libs/format"
import { createRecurringIncome, updateRecurringIncome } from "../actions"
import { isoWeekday, weekdayName } from "../occurrences"
import type { RecurringIncome } from "../queries"
import {
  BIWEEKLY_DEFAULT_DAYS,
  INCOME_FREQUENCIES,
  INTERVAL_DAYS_MAX,
  INTERVAL_DAYS_MIN,
  type IncomeFrequency,
  usesDayOfMonth
} from "../schemas"
import type { RecurringIncomeFormState } from "../types"

/** "enero" → "Enero" */
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: capitalize(monthName(index + 1))
}))

const WEEKDAY_OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: String(index + 1),
  label: capitalize(weekdayName(index + 1))
}))

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  yearly: "Anual",
  daily: "Diaria",
  every_n_days: "Cada N días",
  none: "Sin fecha fija"
}

const FREQUENCY_OPTIONS = INCOME_FREQUENCIES.map((value) => ({
  value,
  label: FREQUENCY_LABELS[value]
}))

const FREQUENCY_HINTS: Record<IncomeFrequency, string> = {
  weekly: "Llega una vez por semana, como el rendimiento de una inversión.",
  biweekly: "Llega dos veces al mes, como la nómina por quincenas.",
  monthly: "Llega una vez al mes, como un salario mensual o un arriendo.",
  yearly: "Llega una vez al año, como una prima o un dividendo anual.",
  daily: "Llega todos los días, como las ventas diarias de un puesto.",
  every_n_days: "Llega cada cierto número de días, contados desde el inicio.",
  none: "Para proyectos o inversiones sin fecha fija. Solo suma lo que recibes."
}

interface ScheduleDraft {
  frequency: IncomeFrequency
  dayOfMonth: string
  secondDay: string
  monthOfYear: string
  dayOfWeek: string
  intervalDays: string
  startsOn: string
  endsOn: string
}

const toNumber = (value: string) => (value === "" ? null : Number(value))

/**
 * Resumen en vivo del calendario: "Cada sábado", "Cada 14 días desde el
 * 3 nov", "Los días 15 y 30 de cada mes"… null si faltan datos o es "Sin
 * fecha fija".
 */
function scheduleSummary(draft: ScheduleDraft): string | null {
  const day = toNumber(draft.dayOfMonth)
  const second = toNumber(draft.secondDay)
  const month = toNumber(draft.monthOfYear)
  const weekday = toNumber(draft.dayOfWeek)
  const interval = toNumber(draft.intervalDays)
  const since = draft.startsOn ? formatShortDate(draft.startsOn) : null

  let text: string | null = null
  switch (draft.frequency) {
    case "weekly":
      text = weekday === null ? null : `Cada ${weekdayName(weekday)}`
      break
    case "daily":
      text = since && `Todos los días desde el ${since}`
      break
    case "every_n_days":
      text =
        interval === null ||
        !Number.isInteger(interval) ||
        interval < INTERVAL_DAYS_MIN ||
        interval > INTERVAL_DAYS_MAX ||
        !since
          ? null
          : `Cada ${interval} días desde el ${since}`
      break
    case "monthly":
      text = day === null ? null : `Cada mes, el día ${day}`
      break
    case "biweekly":
      text =
        day === null || second === null
          ? null
          : `Los días ${day} y ${second} de cada mes`
      break
    case "yearly":
      text =
        day === null || month === null
          ? null
          : `Cada ${day} de ${monthName(month)}`
      break
    case "none":
      return null
  }

  if (text && draft.endsOn) {
    text += ` hasta el ${formatShortDate(draft.endsOn)}`
  }
  return text
}

interface RecurringIncomeDialogProps {
  /** Espacio del ingreso fijo (para crear una categoría o cuenta) */
  workspaceId: string
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita este ingreso fijo */
  income?: RecurringIncome
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RecurringIncomeDialog({
  workspaceId,
  categories,
  accounts,
  income,
  trigger,
  open: controlledOpen,
  onOpenChange
}: RecurringIncomeDialogProps) {
  const isEditing = income !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar ingreso fijo" : "Nuevo ingreso fijo"}
      description={
        isEditing
          ? "Cambia los datos del ingreso fijo."
          : "Un ingreso que se repite, como tu salario, un arriendo que recibes o un proyecto."
      }
    >
      {(close) => (
        <RecurringIncomeForm
          workspaceId={workspaceId}
          categories={categories}
          accounts={accounts}
          income={income}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface RecurringIncomeFormProps {
  workspaceId: string
  categories: Category[]
  accounts: AccountOption[]
  income?: RecurringIncome
  onSaved: () => void
  onCancel: () => void
}

const dayText = (value: number | null | undefined) =>
  value == null ? "" : String(value)

function RecurringIncomeForm({
  workspaceId,
  categories,
  accounts,
  income,
  onSaved,
  onCancel
}: RecurringIncomeFormProps) {
  const isEditing = income !== undefined
  // Solo se aceptan categorías de ingreso y cuentas activas
  const categoryOptions = categories.filter(
    (category) => category.type === "income" && category.archived_at === null
  )
  const accountOptions = selectableAccounts(accounts)
  const currentCategoryArchived =
    income !== undefined && income.category.archived_at !== null
  const currentAccountArchived =
    income?.account_id != null &&
    !accountOptions.some((account) => account.id === income.account_id)

  const [frequency, setFrequency] = useState<IncomeFrequency>(
    income?.frequency ?? "monthly"
  )
  const [categoryId, setCategoryId] = useState(
    currentCategoryArchived ? "" : (income?.category_id ?? "")
  )
  const [accountId, setAccountId] = useState(
    currentAccountArchived ? "" : (income?.account_id ?? "")
  )
  const [dayOfMonth, setDayOfMonth] = useState(dayText(income?.day_of_month))
  const [secondDay, setSecondDay] = useState(
    dayText(income?.second_day_of_month)
  )
  const [monthOfYear, setMonthOfYear] = useState(dayText(income?.month_of_year))
  const [dayOfWeek, setDayOfWeek] = useState(dayText(income?.day_of_week))
  const [intervalDays, setIntervalDays] = useState(
    dayText(income?.interval_days)
  )
  const [amount, setAmount] = useState(amountInput(income?.amount))
  const [startsOn, setStartsOn] = useState(
    () => income?.starts_on ?? todayISO()
  )
  const [endsOn, setEndsOn] = useState(income?.ends_on ?? "")

  const [state, formAction, pending] = useActionState<
    RecurringIncomeFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateRecurringIncome(prevState, formData)
      : await createRecurringIncome(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing ? "Ingreso fijo actualizado" : "Ingreso fijo registrado"
      )
      onSaved()
    }
    return result
  }, {})

  function handleFrequencyChange(next: IncomeFrequency) {
    if (next === frequency) return
    setFrequency(next)
    // Quincenal: propone 15 y 30 si los días están vacíos
    if (next === "biweekly") {
      if (!dayOfMonth) setDayOfMonth(String(BIWEEKLY_DEFAULT_DAYS[0]))
      if (!secondDay) setSecondDay(String(BIWEEKLY_DEFAULT_DAYS[1]))
    }
    // Semanal: propone el día de la semana de la fecha de inicio
    if (next === "weekly" && !dayOfWeek && startsOn) {
      setDayOfWeek(String(isoWeekday(startsOn)))
    }
  }

  const errors = state.fieldErrors
  const values = state.values
  const hasMonthDay = usesDayOfMonth(frequency)
  const summary = scheduleSummary({
    frequency,
    dayOfMonth,
    secondDay,
    monthOfYear,
    dayOfWeek,
    intervalDays,
    startsOn,
    endsOn
  })
  const summaryAmount = parseAmount(amount)

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
          value={income.id}
        />
      )}
      <input
        type="hidden"
        name="frequency"
        value={frequency}
      />

      <TextInputField
        name="name"
        label="Nombre"
        help="recurringIncome.name"
        maxLength={60}
        placeholder="Salario"
        defaultValue={values?.name ?? income?.name}
        isRequired
        error={errors?.name?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="amount"
          label="Monto esperado"
          help="recurringIncome.expected"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          isRequired
          error={errors?.amount?.[0]}
        />

        <CategorySelectField
          name="category_id"
          value={categoryId}
          onChange={setCategoryId}
          categories={categoryOptions}
          workspaceId={workspaceId}
          type="income"
          help="common.category"
          error={errors?.category_id?.[0]}
        >
          {currentCategoryArchived && !categoryId && (
            <p className="text-sm text-muted-foreground">
              La categoría de este ingreso fijo está archivada. Elige otra.
            </p>
          )}
        </CategorySelectField>
      </div>

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

      <div className="flex flex-col gap-2">
        <SelectField
          label="Frecuencia"
          help="common.frequency"
          value={frequency}
          onChange={handleFrequencyChange}
          options={FREQUENCY_OPTIONS}
          error={errors?.frequency?.[0]}
        />
        <p className="text-sm text-muted-foreground">
          {FREQUENCY_HINTS[frequency]}
        </p>
      </div>

      {/* Cada frecuencia pide solo los datos que le aplican */}
      {frequency === "weekly" && (
        <SelectField
          name="day_of_week"
          label="Día de la semana"
          help="recurringIncome.weekday"
          placeholder="Elige un día"
          value={dayOfWeek}
          onChange={setDayOfWeek}
          options={WEEKDAY_OPTIONS}
          error={errors?.day_of_week?.[0]}
        />
      )}

      {frequency === "every_n_days" && (
        <TextInputField
          name="interval_days"
          label="Cada cuántos días"
          help="recurringIncome.everyDays"
          type="number"
          inputMode="numeric"
          min={INTERVAL_DAYS_MIN}
          max={INTERVAL_DAYS_MAX}
          placeholder="14"
          value={intervalDays}
          onChange={(event) => setIntervalDays(event.target.value)}
          isRequired
          error={errors?.interval_days?.[0]}
        />
      )}

      {hasMonthDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInputField
            name="day_of_month"
            label={
              frequency === "biweekly" ? "Primer día de pago" : "Día de pago"
            }
            help="recurringIncome.day"
            helpLabel="Día de pago"
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="30"
            value={dayOfMonth}
            onChange={(event) => setDayOfMonth(event.target.value)}
            isRequired
            error={errors?.day_of_month?.[0]}
          />

          {frequency === "biweekly" && (
            <TextInputField
              name="second_day_of_month"
              label="Segundo día de pago"
              help="recurringIncome.secondDay"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              placeholder="30"
              value={secondDay}
              onChange={(event) => setSecondDay(event.target.value)}
              isRequired
              error={errors?.second_day_of_month?.[0]}
            />
          )}

          {frequency === "yearly" && (
            <SelectField
              name="month_of_year"
              label="Mes de pago"
              help="recurringIncome.month"
              placeholder="Elige un mes"
              value={monthOfYear}
              onChange={setMonthOfYear}
              options={MONTH_OPTIONS}
              error={errors?.month_of_year?.[0]}
            />
          )}
        </div>
      )}
      {hasMonthDay && (
        <p className="-mt-2 text-sm text-muted-foreground">
          Si el mes no tiene ese día, cuenta el último día del mes.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerField
          name="starts_on"
          label="Desde"
          help="common.from"
          value={startsOn}
          onChange={setStartsOn}
          error={errors?.starts_on?.[0]}
          isRequired
        />

        <div className="flex items-end gap-1">
          <DatePickerField
            name="ends_on"
            label="Hasta (opcional)"
            help="common.until"
            value={endsOn}
            onChange={setEndsOn}
            error={errors?.ends_on?.[0]}
            className="flex flex-1 flex-col gap-2"
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
      </div>

      {summary && (
        <p
          aria-live="polite"
          className="rounded-2xl bg-subtle px-4 py-3 text-sm font-medium first-letter:uppercase"
        >
          {summary}
          {summaryAmount > 0 && (
            <>
              {" · "}
              <Amount value={summaryAmount} />
            </>
          )}
        </p>
      )}

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
