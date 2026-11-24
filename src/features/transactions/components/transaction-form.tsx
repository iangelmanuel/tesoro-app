"use client"

import { useState } from "react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import type { Category } from "@/features/categories/queries"
import {
  OccurrenceSelect,
  paymentKey,
  selectedPayment
} from "@/features/recurring-expenses/components/occurrence-select"
import { recurringPaymentValues } from "@/features/recurring-expenses/payment"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import { IncomeReceiptPreview } from "@/features/recurring-incomes/components/income-receipt-preview"
import { IncomeSourceField } from "@/features/recurring-incomes/components/income-source-field"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import {
  TRANSACTION_COPY,
  transactionCategoryOptions
} from "../transaction-form-values"
import type {
  EditableTransaction,
  FormPanel,
  RecurringOccurrenceLink,
  TransactionInitialValues
} from "../types"
import {
  TransactionBusinessFields,
  TransactionHiddenFields,
  TransactionNoteField
} from "./transaction-form-fields"
import {
  PanelEmpty,
  type PanelProps,
  type PaymentTabsData,
  renderPaymentPanel
} from "./transaction-form-panels"
import { TransactionTypeTabs } from "./transaction-type-tabs"
import { useTransactionForm } from "./use-transaction-form"

interface TransactionFormProps {
  workspaceId: string
  workspaceType: WorkspaceType
  categories: Category[]
  accounts: PaymentAccountOption[]
  transaction?: EditableTransaction
  initialValues?: TransactionInitialValues
  recurring?: RecurringOccurrenceLink
  paymentTabs?: PaymentTabsData
  incomeSources?: IncomeSourceOption[]
  initialPanel?: FormPanel
  /** Sin selector de tipo (el pago de gasto fijo dentro de su tab) */
  hideTypeToggle?: boolean
  onSaved: () => void
  onCancel: () => void
}

/**
 * Formulario de movimiento del diálogo: entrada o salida, o uno de los
 * paneles de traspaso, pago o aporte que elige el selector de tipo
 */
export function TransactionForm({
  workspaceId,
  workspaceType,
  categories,
  accounts,
  transaction,
  initialValues,
  recurring,
  paymentTabs,
  incomeSources,
  initialPanel,
  hideTypeToggle = false,
  onSaved,
  onCancel
}: TransactionFormProps) {
  const form = useTransactionForm({
    categories,
    accounts,
    transaction,
    initialValues,
    recurring,
    incomeSources,
    initialPanel,
    onSaved
  })
  const { type, panel, state } = form
  const isEditing = transaction !== undefined
  const isBusiness = workspaceType === "business"
  const copy = TRANSACTION_COPY[workspaceType]
  // Un pago de gasto fijo, nuevo o editado, siempre es un gasto
  const isLinked =
    recurring !== undefined || Boolean(transaction?.recurring_expense_id)
  const canTransfer =
    !isEditing && !isLinked && selectableAccounts(accounts).length >= 2

  const options = transactionCategoryOptions(
    categories,
    type,
    transaction?.category_id
  )

  const errors = state.fieldErrors
  const values = state.values
  const showIncomeSource =
    !isBusiness && type === "income" && incomeSources !== undefined
  // Ingreso fijo con calendario elegido: muestra el reparto bajo el monto
  const incomeSource = showIncomeSource
    ? incomeSources.find((source) => source.id === form.incomeSourceId)
    : undefined
  const showTransfer = !isEditing && type === "expense" && !isBusiness

  const typeToggle = hideTypeToggle ? null : (
    <TransactionTypeTabs
      workspaceType={workspaceType}
      value={form.activeTab}
      onValueChange={form.handleTypeChange}
      disabled={isLinked}
      canTransfer={canTransfer}
      showPaymentTabs={paymentTabs !== undefined}
      tabsRef={form.tabsRef}
    />
  )

  const panelProps = { workspaceId, accounts, onSaved, onCancel }
  // Gasto fijo se arma aquí porque reusa TransactionForm; los demás paneles
  // salen de transaction-form-panels
  const panelContent =
    panel === "recurring" && paymentTabs ? (
      <RecurringPaymentPanel
        payments={paymentTabs.pendingPayments}
        categories={categories}
        {...panelProps}
      />
    ) : (
      renderPaymentPanel(panel, paymentTabs, panelProps)
    )

  if (panelContent) {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        {panelContent}
      </div>
    )
  }

  return (
    <form
      action={form.formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <TransactionHiddenFields
        id={transaction?.id}
        workspaceId={workspaceId}
        type={type}
        recurring={recurring}
      />

      {typeToggle}

      {/* En Ingreso es el primer campo: prellena los siguientes */}
      {showIncomeSource && (
        <IncomeSourceField
          sources={incomeSources}
          value={form.incomeSourceId}
          onChange={form.handleIncomeSourceChange}
          current={
            transaction?.recurring_income_id
              ? { id: transaction.recurring_income_id }
              : null
          }
        />
      )}

      <TextInputField
        name="amount"
        label="Monto"
        help="common.amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={form.amountText}
        onChange={(event) => form.setAmountText(event.target.value)}
        isRequired
        error={errors?.amount?.[0]}
      />
      {incomeSource && (
        <IncomeReceiptPreview
          source={incomeSource}
          amount={parsePaymentAmount(form.amountText) ?? 0}
          hideError={Boolean(errors?.amount)}
          own={
            incomeSource.id === transaction?.recurring_income_id
              ? transaction.recurring_income_allocations
              : []
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          help="common.date"
          value={form.date}
          onChange={form.setDate}
          error={errors?.occurred_on?.[0]}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          help="common.time"
          value={form.time}
          onChange={form.setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <CategorySelectField
        name="category_id"
        value={form.categoryId}
        onChange={form.setCategoryId}
        categories={options}
        workspaceId={workspaceId}
        type={type}
        help="common.category"
        error={errors?.category_id?.[0]}
      >
        {form.initialCategoryUnavailable && !form.categoryId && (
          <FieldDescription>
            La categoría de este gasto fijo está archivada. Elige otra.
          </FieldDescription>
        )}
      </CategorySelectField>

      {/* Un gasto nuevo de Personal puede traspasar fondos antes de pagar
          (SPEC 16). Al editar, y en ingresos o Empresa, solo se elige la
          cuenta: activas, más la actual del movimiento editado aunque esté
          archivada, para poder guardar sin cambiarla */}
      {showTransfer ? (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={parsePaymentAmount(form.amountText)}
          errors={{
            account_id: errors?.account_id?.[0],
            transfer_from: errors?.transfer_from?.[0],
            transfer_amount: errors?.transfer_amount?.[0]
          }}
          direction="out"
          defaultAccountId={form.accountId}
          onAccountChange={form.setAccountId}
        />
      ) : (
        <AccountSelectField
          workspaceId={workspaceId}
          name="account_id"
          label="Cuenta"
          help="common.account"
          value={form.accountId}
          onChange={form.setAccountId}
          accounts={selectableAccounts(accounts, transaction?.account_id)}
          allowNone
          error={errors?.account_id?.[0]}
        />
      )}

      <TextInputField
        name="description"
        label="Descripción"
        help="common.description"
        maxLength={120}
        placeholder={copy.placeholder[type]}
        value={form.description}
        onChange={(event) => form.setDescription(event.target.value)}
        isRequired
        error={errors?.description?.[0]}
      />

      {isBusiness && (
        <TransactionBusinessFields
          type={type}
          counterparty={
            values?.counterparty ??
            transaction?.counterparty ??
            initialValues?.counterparty ??
            ""
          }
          invoiceRef={values?.invoice_ref ?? transaction?.invoice_ref ?? ""}
          errors={errors}
        />
      )}

      <TransactionNoteField
        defaultValue={
          values?.note ?? transaction?.note ?? initialValues?.note ?? ""
        }
        errors={errors}
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
          disabled={form.pending}
        >
          {submitLabel(form.pending, isEditing)}
        </Button>
      </div>
    </form>
  )
}

function submitLabel(pending: boolean, isEditing: boolean): string {
  if (pending) {
    return "Guardando..."
  }
  return isEditing ? "Guardar" : "Registrar"
}

interface RecurringPaymentPanelProps extends PanelProps {
  payments: UpcomingPayment[]
  categories: Category[]
}

/**
 * Tab "Gasto fijo": elegir la ocurrencia pendiente y confirmar su pago en el
 * mismo formulario, prellenado y enlazado. Mismo resultado que "Marcar gasto
 * fijo pagado" de la hoja móvil
 */
function RecurringPaymentPanel({
  workspaceId,
  payments,
  categories,
  accounts,
  onSaved,
  onCancel
}: RecurringPaymentPanelProps) {
  const [selectedKey, setSelectedKey] = useState("")
  const selected = selectedPayment(payments, selectedKey)

  if (payments.length === 0) {
    return (
      <PanelEmpty
        text="No tienes gastos fijos pendientes de pago."
        href={RECURRING_PATH}
        action="Ir a Gastos fijos"
        onNavigate={onCancel}
      />
    )
  }

  return (
    <>
      <OccurrenceSelect
        payments={payments}
        selected={selected}
        onChange={setSelectedKey}
      />
      {selected && (
        <TransactionForm
          // Cada ocurrencia monta el formulario con sus propios valores
          key={paymentKey(selected)}
          workspaceId={workspaceId}
          workspaceType="personal"
          categories={categories}
          accounts={accounts}
          // Sin occurred_on: el pago ocurre hoy (SPEC 41); la cuota elegida
          // conserva su vencimiento en recurring.dueOn
          initialValues={recurringPaymentValues(selected, accounts)}
          recurring={{
            recurringExpenseId: selected.recurringExpenseId,
            dueOn: selected.dueOn
          }}
          hideTypeToggle
          onSaved={onSaved}
          onCancel={onCancel}
        />
      )}
    </>
  )
}
