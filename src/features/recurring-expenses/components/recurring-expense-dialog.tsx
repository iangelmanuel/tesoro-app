"use client"

import { useActionState, useState } from "react"
import { X } from "lucide-react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { amountInput } from "@/components/forms/amount-format"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { createRecurringExpense, updateRecurringExpense } from "../actions"
import { monthName } from "../occurrences"
import type { RecurringExpense } from "../queries"
import type { RecurringFrequency } from "../schemas"
import type { RecurringExpenseFormState } from "../types"

/** "enero" → "Enero": opciones del mes de pago */
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const name = monthName(index + 1)
  return {
    value: String(index + 1),
    label: name.charAt(0).toUpperCase() + name.slice(1)
  }
})

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" }
] as const satisfies readonly { value: RecurringFrequency; label: string }[]

interface RecurringExpenseDialogProps {
  /** Espacio del gasto fijo (para crear una categoría desde el select) */
  workspaceId: string
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas (cuenta por defecto) */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita este gasto fijo */
  expense?: RecurringExpense
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RecurringExpenseDialog({
  workspaceId,
  categories,
  accounts,
  expense,
  trigger,
  open: controlledOpen,
  onOpenChange
}: RecurringExpenseDialogProps) {
  const isEditing = expense !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar gasto fijo" : "Nuevo gasto fijo"}
      description={
        isEditing
          ? "Cambia los datos del gasto fijo."
          : "Un pago que se repite cada mes o cada año, como el arriendo o una suscripción."
      }
    >
      {(close) => (
        <RecurringExpenseForm
          workspaceId={workspaceId}
          categories={categories}
          accounts={accounts}
          expense={expense}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface RecurringExpenseFormProps {
  workspaceId: string
  categories: Category[]
  accounts: AccountOption[]
  expense?: RecurringExpense
  onSaved: () => void
  onCancel: () => void
}

function RecurringExpenseForm({
  workspaceId,
  categories,
  accounts,
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
  // Cuenta por defecto (SPEC 41): solo activas; una archivada se vacía
  const accountOptions = selectableAccounts(accounts)
  const currentAccountArchived =
    expense?.account_id != null &&
    !accountOptions.some((account) => account.id === expense.account_id)

  const [frequency, setFrequency] = useState<RecurringFrequency>(
    expense?.frequency ?? "monthly"
  )
  const [categoryId, setCategoryId] = useState(
    currentCategoryArchived ? "" : (expense?.category_id ?? "")
  )
  const [accountId, setAccountId] = useState(
    currentAccountArchived ? "" : (expense?.account_id ?? "")
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

      <TextInputField
        name="name"
        label="Nombre"
        help="recurringExpense.name"
        maxLength={60}
        placeholder="Arriendo"
        defaultValue={values?.name ?? expense?.name}
        isRequired
        error={errors?.name?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="amount"
          label="Monto"
          help="recurringExpense.amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          defaultValue={values?.amount ?? amountInput(expense?.amount)}
          isRequired
          error={errors?.amount?.[0]}
        />

        <CategorySelectField
          name="category_id"
          value={categoryId}
          onChange={setCategoryId}
          categories={options}
          workspaceId={workspaceId}
          type="expense"
          help="common.category"
          error={errors?.category_id?.[0]}
        >
          {currentCategoryArchived && !categoryId && (
            <p className="text-sm text-muted-foreground">
              La categoría de este gasto fijo está archivada. Elige otra.
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

      <SegmentedField
        label="Frecuencia"
        help="common.frequency"
        value={frequency}
        onChange={setFrequency}
        options={FREQUENCY_OPTIONS}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="day_of_month"
          label="Día de pago"
          help="recurringExpense.day"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          placeholder="5"
          defaultValue={
            values?.day_of_month ??
            (expense ? String(expense.day_of_month) : undefined)
          }
          isRequired
          error={errors?.day_of_month?.[0]}
        />

        {/* El mes de pago solo aplica a los anuales */}
        {frequency === "yearly" && (
          <SelectField
            name="month_of_year"
            label="Mes de pago"
            help="recurringExpense.month"
            placeholder="Elige un mes"
            value={monthOfYear}
            onChange={setMonthOfYear}
            options={MONTH_OPTIONS}
            error={errors?.month_of_year?.[0]}
          />
        )}
      </div>

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
