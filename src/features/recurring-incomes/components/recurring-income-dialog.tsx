"use client"

import { X } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import type { AccountOption } from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { parseAmount } from "@/features/transactions/schemas"
import {
  FREQUENCY_HINTS,
  FREQUENCY_OPTIONS,
  scheduleSummary
} from "../income-schedule"
import type { RecurringIncome } from "../queries"
import { RecurringIncomeDialogSchedule } from "./recurring-income-dialog-schedule"
import { useRecurringIncomeForm } from "./use-recurring-income-form"

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

function RecurringIncomeForm({
  workspaceId,
  categories,
  accounts,
  income,
  onSaved,
  onCancel
}: RecurringIncomeFormProps) {
  const form = useRecurringIncomeForm({
    categories,
    accounts,
    income,
    onSaved
  })
  const { isEditing, state, draft } = form
  const errors = state.fieldErrors
  const values = state.values
  const summary = scheduleSummary(draft)
  const summaryAmount = parseAmount(form.amount)

  return (
    <form
      action={form.formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {income && (
        <input
          type="hidden"
          name="id"
          value={income.id}
        />
      )}
      <input
        type="hidden"
        name="frequency"
        value={draft.frequency}
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
          value={form.amount}
          onChange={(event) => form.setAmount(event.target.value)}
          isRequired
          error={errors?.amount?.[0]}
        />

        <CategorySelectField
          name="category_id"
          value={form.categoryId}
          onChange={form.setCategoryId}
          categories={form.categoryOptions}
          workspaceId={workspaceId}
          type="income"
          help="common.category"
          error={errors?.category_id?.[0]}
        >
          {form.currentCategoryArchived && !form.categoryId && (
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
        value={form.accountId}
        onChange={form.setAccountId}
        accounts={form.accountOptions}
        workspaceId={workspaceId}
        allowNone
        error={errors?.account_id?.[0]}
      />

      <div className="flex flex-col gap-2">
        <SelectField
          label="Frecuencia"
          help="common.frequency"
          value={draft.frequency}
          onChange={form.changeFrequency}
          options={FREQUENCY_OPTIONS}
          error={errors?.frequency?.[0]}
        />
        <p className="text-sm text-muted-foreground">
          {FREQUENCY_HINTS[draft.frequency]}
        </p>
      </div>

      {/* Cada frecuencia pide solo los datos que le aplican */}
      <RecurringIncomeDialogSchedule
        draft={draft}
        onChange={form.setField}
        errors={errors}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerField
          name="starts_on"
          label="Desde"
          help="common.from"
          value={draft.startsOn}
          onChange={(value) => form.setField("startsOn", value)}
          error={errors?.starts_on?.[0]}
          isRequired
        />

        <div className="flex items-end gap-1">
          <DatePickerField
            name="ends_on"
            label="Hasta (opcional)"
            help="common.until"
            value={draft.endsOn}
            onChange={(value) => form.setField("endsOn", value)}
            error={errors?.ends_on?.[0]}
            className="flex flex-1 flex-col gap-2"
          />
          {draft.endsOn && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar fecha de fin"
              onClick={() => form.setField("endsOn", "")}
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
          disabled={form.pending}
        >
          {submitLabel(form.pending, isEditing)}
        </Button>
      </div>
    </form>
  )
}

function submitLabel(pending: boolean, isEditing: boolean) {
  if (pending) return "Guardando..."
  return isEditing ? "Guardar" : "Crear"
}
