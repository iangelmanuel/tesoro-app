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
  toast
} from "@heroui/react"
import { X } from "lucide-react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { monthName } from "@/features/recurring-expenses/occurrences"
import { todayISO } from "@/libs/dates"
import { createRecurringIncome, updateRecurringIncome } from "../actions"
import type { RecurringIncome } from "../queries"
import {
  BIWEEKLY_DEFAULT_DAYS,
  INCOME_FREQUENCIES,
  type IncomeFrequency
} from "../schemas"
import type { RecurringIncomeFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  yearly: "Anual",
  none: "Sin fecha fija"
}

const FREQUENCY_HINTS: Record<IncomeFrequency, string> = {
  monthly: "Llega una vez al mes, como un salario mensual o un arriendo.",
  biweekly: "Llega dos veces al mes, como la nómina por quincenas.",
  yearly: "Llega una vez al año, como una prima o un dividendo anual.",
  none: "Para proyectos o inversiones sin fecha fija. Solo suma lo que recibes."
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
  trigger?: React.ReactNode
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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = income !== undefined

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
                {isEditing ? "Editar ingreso fijo" : "Nuevo ingreso fijo"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos del ingreso fijo."
                  : "Un ingreso que se repite, como tu salario, un arriendo que recibes o un proyecto."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <RecurringIncomeForm
                workspaceId={workspaceId}
                categories={categories}
                accounts={accounts}
                income={income}
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

  function handleFrequencyChange(key: React.Key | null) {
    if (key == null || key === frequency) return
    const next = key as IncomeFrequency
    setFrequency(next)
    // Quincenal: propone 15 y 30 si los días están vacíos
    if (next === "biweekly") {
      if (!dayOfMonth) setDayOfMonth(String(BIWEEKLY_DEFAULT_DAYS[0]))
      if (!secondDay) setSecondDay(String(BIWEEKLY_DEFAULT_DAYS[1]))
    }
  }

  const errors = state.fieldErrors
  const values = state.values
  const hasSchedule = frequency !== "none"

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

      <TextField
        name="name"
        maxLength={60}
        defaultValue={values?.name ?? income?.name}
        isRequired
        isInvalid={Boolean(errors?.name)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input placeholder="Salario" />
        <FieldError>{errors?.name?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.amount ??
            (income ? AMOUNT_FORMAT.format(income.amount) : "")
          }
          isRequired
          isInvalid={Boolean(errors?.amount)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Monto esperado</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.amount?.[0]}</FieldError>
        </TextField>

        <CategorySelectField
          name="category_id"
          value={categoryId}
          onChange={setCategoryId}
          categories={categoryOptions}
          workspaceId={workspaceId}
          type="income"
          error={errors?.category_id?.[0]}
        >
          {currentCategoryArchived && !categoryId && (
            <p className="text-sm text-muted">
              La categoría de este ingreso fijo está archivada. Elige otra.
            </p>
          )}
        </CategorySelectField>
      </div>

      <AccountSelectField
        name="account_id"
        label="Cuenta por defecto (opcional)"
        value={accountId}
        onChange={setAccountId}
        accounts={accountOptions}
        workspaceId={workspaceId}
        allowNone
        error={errors?.account_id?.[0]}
      />

      <div className="flex flex-col gap-2">
        <Select
          fullWidth
          value={frequency}
          onChange={handleFrequencyChange}
          isInvalid={Boolean(errors?.frequency)}
          className="flex flex-col gap-2"
        >
          <Label>Frecuencia</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {INCOME_FREQUENCIES.map((option) => (
                <ListBox.Item
                  key={option}
                  id={option}
                  textValue={FREQUENCY_LABELS[option]}
                >
                  {FREQUENCY_LABELS[option]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.frequency?.[0]}</FieldError>
        </Select>
        <p className="text-sm text-muted">{FREQUENCY_HINTS[frequency]}</p>
      </div>

      {/* Cada frecuencia pide solo los días que le aplican */}
      {hasSchedule && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="day_of_month"
            inputMode="numeric"
            value={dayOfMonth}
            onChange={setDayOfMonth}
            isRequired
            isInvalid={Boolean(errors?.day_of_month)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>
              {frequency === "biweekly" ? "Primer día de pago" : "Día de pago"}
            </Label>
            <Input
              type="number"
              min={1}
              max={31}
              placeholder="30"
            />
            <FieldError>{errors?.day_of_month?.[0]}</FieldError>
          </TextField>

          {frequency === "biweekly" && (
            <TextField
              name="second_day_of_month"
              inputMode="numeric"
              value={secondDay}
              onChange={setSecondDay}
              isRequired
              isInvalid={Boolean(errors?.second_day_of_month)}
              validationBehavior="aria"
              className="flex flex-col gap-2"
            >
              <Label>Segundo día de pago</Label>
              <Input
                type="number"
                min={1}
                max={31}
                placeholder="30"
              />
              <FieldError>{errors?.second_day_of_month?.[0]}</FieldError>
            </TextField>
          )}

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
      )}
      {hasSchedule && (
        <p className="-mt-2 text-sm text-muted">
          Si el mes no tiene ese día, cuenta el último día del mes.
        </p>
      )}

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
