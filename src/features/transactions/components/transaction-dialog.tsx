"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import type { Route } from "next"
import Link from "next/link"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { toast } from "@/components/ui/sonner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { TransferForm } from "@/features/accounts/components/transfer-dialog"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import type { Category } from "@/features/categories/queries"
import { DEBTS_PATH, RECEIVABLES_PATH } from "@/features/debts/calculations"
import {
  type DebtOption,
  DebtPaymentPanel
} from "@/features/debts/components/payment-dialog"
import { ReceivableCollectForm } from "@/features/debts/components/receivable-collect-form"
import type { CollectableReceivable } from "@/features/debts/receivable-collect"
import {
  GoalContributionPanel,
  type GoalOption
} from "@/features/goals/components/contribution-dialog"
import { GOALS_PATH } from "@/features/goals/progress"
import {
  OccurrenceSelect,
  paymentKey,
  selectedPayment
} from "@/features/recurring-expenses/components/occurrence-select"
import { recurringPaymentValues } from "@/features/recurring-expenses/payment"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import { IncomeReceiptPreview } from "@/features/recurring-incomes/components/income-receipt-preview"
import { IncomeSourceField } from "@/features/recurring-incomes/components/income-source-field"
import { OTHER_INCOME } from "@/features/recurring-incomes/constants"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import {
  describeSavedReceipt,
  incomeReceiptValues
} from "@/features/recurring-incomes/receipt"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import { createTransaction, updateTransaction } from "../actions"
import type { TransactionType } from "../filters"
import type { EditableTransaction } from "../queries"
import type { TransactionFormState } from "../types"

const AMOUNT_FORMAT = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2
})

// Textos que cambian entre Personal y Empresa
const COPY = {
  personal: {
    expense: "Salida",
    income: "Entrada",
    description: "Registra una entrada o una salida de tu espacio Personal.",
    placeholder: { expense: "Mercado de la semana", income: "Salario" }
  },
  business: {
    expense: "Salida",
    income: "Entrada",
    description: "Registra una entrada o una salida de tu empresa.",
    placeholder: { expense: "Compra de insumos", income: "Venta del día" }
  }
} as const

/** Valores con los que se prellena un movimiento nuevo */
export interface TransactionInitialValues {
  /** Tipo preseleccionado (gasto por defecto) */
  type?: TransactionType
  amount?: number
  category_id?: string
  occurred_on?: string
  description?: string
  /** Cuenta prellenada (la cuenta por defecto de un ingreso fijo) */
  account_id?: string | null
  /** Ingreso fijo elegido en el select (Marcar recibido) */
  recurring_income_id?: string
  /** Nota copiada de otro movimiento (Duplicar, SPEC 49) */
  note?: string
  /** Cliente o proveedor copiado de otro movimiento (Empresa, SPEC 49) */
  counterparty?: string | null
}

/** Ocurrencia de gasto fijo que paga el movimiento nuevo */
export interface RecurringOccurrenceLink {
  recurringExpenseId: string
  dueOn: string
}

interface TransactionDialogProps {
  /** Espacio donde se crea o edita el movimiento */
  workspaceId: string
  /** En Empresa cambian los textos y aparecen cliente/proveedor y factura */
  workspaceType?: WorkspaceType
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: PaymentAccountOption[]
  /** Si llega, el diálogo edita este movimiento */
  transaction?: EditableTransaction
  /** Prellenado de un movimiento nuevo */
  initialValues?: TransactionInitialValues
  /** Si llega, el movimiento nuevo es el pago de esta ocurrencia */
  recurring?: RecurringOccurrenceLink
  /**
   * Tabs "Deuda" (pagos y avances) y "Gasto fijo" (solo Personal y al
   * registrar):
   * deudas activas y ocurrencias sin pagar. Los pasa el botón del header
   */
  paymentTabs?: PaymentTabsData
  /**
   * Ingresos fijos activos para el select "Ingreso fijo" del tab Ingreso
   * (solo Personal). Sin ellos no hay select y, al editar, el enlace se
   * conserva
   */
  incomeSources?: IncomeSourceOption[]
  /**
   * Tab de pago con el que abre (p. ej. "receivable" desde "Cobro de Me
   * deben" del menú Más). Solo aplica con `paymentTabs`
   */
  initialPanel?: FormPanel
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TransactionDialog({
  workspaceId,
  workspaceType = "personal",
  categories,
  accounts,
  transaction,
  initialValues,
  recurring,
  paymentTabs,
  incomeSources,
  initialPanel,
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransactionDialogProps) {
  const isEditing = transaction !== undefined
  const isPayment = !isEditing && recurring !== undefined
  // Empresa no tiene deudas ni gastos fijos; al editar o pagar una
  // ocurrencia concreta tampoco aplican
  const showPaymentTabs =
    paymentTabs !== undefined &&
    workspaceType === "personal" &&
    !isEditing &&
    !isPayment

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      // Con 7 tabs el diálogo se ensancha para que quepan en escritorio
      className={showPaymentTabs ? "sm:max-w-xl" : undefined}
      title={
        isEditing
          ? "Editar movimiento"
          : isPayment
            ? "Registrar pago"
            : "Nuevo movimiento"
      }
      description={
        isEditing
          ? "Cambia los datos del movimiento."
          : isPayment
            ? "Confirma los datos del pago. Puedes ajustar el monto."
            : COPY[workspaceType].description
      }
    >
      {(close) => (
        <TransactionForm
          workspaceId={workspaceId}
          workspaceType={workspaceType}
          categories={categories}
          accounts={accounts}
          transaction={transaction}
          initialValues={isEditing ? undefined : initialValues}
          recurring={isEditing ? undefined : recurring}
          paymentTabs={showPaymentTabs ? paymentTabs : undefined}
          // El traspaso existe en ambos espacios (atajo T, SPEC 51)
          initialPanel={
            showPaymentTabs || initialPanel === "transfer"
              ? initialPanel
              : undefined
          }
          incomeSources={
            workspaceType === "personal" && !isPayment
              ? (incomeSources ?? paymentTabs?.incomeSources)
              : undefined
          }
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

/** Datos de los tabs de pago del diálogo (acceso rápido del header) */
export interface PaymentTabsData {
  /** Deudas activas: tarjetas y préstamos */
  debts: DebtOption[]
  /** Cuentas por cobrar activas (tab "Me deben", SPEC 39) */
  receivables: CollectableReceivable[]
  /** Ocurrencias de gastos fijos sin pagar, vencidas primero */
  pendingPayments: UpcomingPayment[]
  /** Metas activas (tab "Meta") */
  goals: GoalOption[]
  /** Ingresos fijos activos (select "Ingreso fijo" del tab Ingreso) */
  incomeSources: IncomeSourceOption[]
}

/** Opciones del selector que no son un tipo de movimiento */
export type FormPanel =
  "transfer" | "debt_payment" | "receivable" | "recurring" | "goal"

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

function TransactionForm({
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
  const isEditing = transaction !== undefined
  const isBusiness = workspaceType === "business"
  const copy = COPY[workspaceType]
  // Un pago de gasto fijo, nuevo o editado, siempre es un gasto
  const isLinked =
    recurring !== undefined || Boolean(transaction?.recurring_expense_id)

  // La categoría prellenada solo se usa si sigue activa (regla del SPEC 02)
  const initialCategory = categories.find(
    (category) => category.id === initialValues?.category_id
  )
  const initialCategoryUnavailable =
    initialValues?.category_id !== undefined &&
    (initialCategory === undefined || initialCategory.archived_at !== null)

  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? initialValues?.type ?? "expense"
  )
  const [categoryId, setCategoryId] = useState(
    transaction?.category_id ??
      (initialCategoryUnavailable ? "" : (initialValues?.category_id ?? ""))
  )
  const [date, setDate] = useState(
    () => transaction?.occurred_on ?? initialValues?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => transaction?.occurred_time?.slice(0, 5) ?? ""
  )
  const [accountId, setAccountId] = useState(
    transaction?.account_id ?? initialValues?.account_id ?? ""
  )
  const [amountText, setAmountText] = useState(() =>
    transaction
      ? AMOUNT_FORMAT.format(transaction.amount)
      : initialValues?.amount !== undefined
        ? AMOUNT_FORMAT.format(initialValues.amount)
        : ""
  )
  // Select "Ingreso fijo" (SPEC 30): al elegir uno se prellenan monto,
  // categoría y cuenta, solo si el usuario no los cambió. `prefilled` guarda
  // lo último que se prellenó para saber si el campo sigue intacto
  const [incomeSourceId, setIncomeSourceId] = useState(
    transaction?.recurring_income_id ??
      initialValues?.recurring_income_id ??
      OTHER_INCOME
  )
  // Controlada para prellenar "Ingreso {nombre} · {periodo}" al elegir un
  // ingreso fijo (SPEC 41); lo que el usuario escriba se respeta
  const [description, setDescription] = useState(
    () => transaction?.description ?? initialValues?.description ?? ""
  )
  const [prefilled, setPrefilled] = useState(() =>
    initialValues?.recurring_income_id
      ? {
          amount: amountText,
          category: categoryId,
          account: accountId,
          description
        }
      : { amount: "", category: "", account: "", description: "" }
  )
  // Un movimiento nuevo y suelto también puede ser un traspaso entre dos
  // cuentas propias (se guarda en transfers y no cuenta como ingreso ni
  // gasto), un pago de deuda o el pago de un gasto fijo
  const [panel, setPanel] = useState<FormPanel | null>(initialPanel ?? null)
  const canTransfer =
    !isEditing && !isLinked && selectableAccounts(accounts).length >= 2

  const [state, formAction, pending] = useActionState<
    TransactionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateTransaction(prevState, formData)
      : await createTransaction(prevState, formData)

    if (result.ok) {
      // Con ingreso fijo, el toast describe el reparto que guardó el servidor
      const receipt = describeSavedReceipt(result.allocations ?? [])
      toast.success(
        isEditing
          ? "Movimiento actualizado"
          : recurring
            ? "Pago registrado"
            : "Movimiento registrado",
        receipt ? { description: receipt } : undefined
      )
      onSaved()
    }
    return result
  }, {})

  // Solo activas del tipo elegido, más la actual del movimiento editado
  // aunque esté archivada, para poder guardar sin cambiarla
  const options = categories.filter(
    (category) =>
      category.type === type &&
      (category.archived_at === null ||
        category.id === transaction?.category_id)
  )

  function handleTypeChange(values: unknown[]) {
    const [value] = values
    // Un tab ya elegido no se apaga: siempre hay uno activo
    if (!value) return
    if (
      value === "transfer" ||
      value === "debt_payment" ||
      value === "receivable" ||
      value === "recurring" ||
      value === "goal"
    ) {
      setPanel(value)
      return
    }
    setPanel(null)
    if (value === type) return
    setType(value as TransactionType)
    setCategoryId("")
  }

  function handleIncomeSourceChange(value: string) {
    setIncomeSourceId(value)
    const source = incomeSources?.find((option) => option.id === value)
    if (!source) return

    const values = incomeReceiptValues(source, { categories, accounts })
    const next = {
      amount: AMOUNT_FORMAT.format(values.amount),
      category: values.category_id ?? "",
      account: values.account_id ?? "",
      description: values.description
    }

    if (amountText === "" || amountText === prefilled.amount) {
      setAmountText(next.amount)
    }
    if (categoryId === "" || categoryId === prefilled.category) {
      setCategoryId(next.category)
    }
    if (accountId === "" || accountId === prefilled.account) {
      setAccountId(next.account)
    }
    if (description === "" || description === prefilled.description) {
      setDescription(next.description)
    }
    setPrefilled(next)
  }

  // En un teléfono angosto los tabs se desplazan: el activo se lleva a la
  // vista al cambiar de tab
  const tabsRef = useRef<HTMLDivElement>(null)
  const activeTab = panel ?? type
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>("[data-pressed]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeTab])

  const errors = state.fieldErrors
  const values = state.values
  const showIncomeSource =
    !isBusiness && type === "income" && incomeSources !== undefined
  // Ingreso fijo con calendario elegido: muestra el reparto bajo el monto
  const incomeSource = showIncomeSource
    ? incomeSources.find((source) => source.id === incomeSourceId)
    : undefined
  const showTransfer = !isEditing && type === "expense" && !isBusiness
  const typeLabelId = useId()
  const noteId = useId()

  const tab = (id: TransactionType | FormPanel, label: string) => (
    <ToggleGroupItem
      key={id}
      value={id}
      className="h-full flex-1 px-2.5 whitespace-nowrap data-pressed:bg-card data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-(--surface-shadow) dark:data-pressed:bg-highlight"
    >
      {label}
    </ToggleGroupItem>
  )

  // Orden de los tabs (SPEC 30, 39 y 41). Personal: Gasto, Ingreso,
  // Traspaso, Gasto fijo, Deuda, Me deben y Meta. Empresa: Venta, Costo o
  // gasto y Traspaso
  const typeToggle = hideTypeToggle ? null : (
    <div className="flex flex-col gap-2">
      <FieldLabel
        id={typeLabelId}
        help="transaction.type"
      >
        Tipo
      </FieldLabel>
      {/* Con los tabs de pago son 7 opciones. Desde sm caben en el diálogo; en
        un teléfono angosto se desplazan en horizontal, sin barra visible */}
      <div
        ref={tabsRef}
        className={cn(
          paymentTabs &&
            "-mx-1 [scrollbar-width:none] overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
        )}
      >
        <ToggleGroup
          value={[panel ?? type]}
          onValueChange={handleTypeChange}
          disabled={isLinked}
          aria-labelledby={typeLabelId}
          spacing={1}
          className={cn(
            "h-12 w-full rounded-4xl bg-subtle p-0.5 dark:bg-card",
            paymentTabs && "w-max min-w-full"
          )}
        >
          {isBusiness
            ? tab("income", copy.income)
            : tab("expense", copy.expense)}
          {isBusiness
            ? tab("expense", copy.expense)
            : tab("income", copy.income)}
          {canTransfer && tab("transfer", "Traspaso")}
          {paymentTabs && tab("recurring", "Gasto fijo")}
          {paymentTabs && tab("debt_payment", "Deuda")}
          {paymentTabs && tab("receivable", "Me deben")}
          {paymentTabs && tab("goal", "Meta")}
        </ToggleGroup>
      </div>
    </div>
  )

  if (panel === "transfer") {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        <p className="text-sm text-muted-foreground">
          Mueve plata entre tus cuentas. No cuenta como entrada ni salida.
        </p>
        <TransferForm
          workspaceId={workspaceId}
          accounts={accounts}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </div>
    )
  }

  if (panel === "debt_payment" && paymentTabs) {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        {paymentTabs.debts.length > 0 ? (
          <DebtPaymentPanel
            workspaceId={workspaceId}
            debts={paymentTabs.debts}
            accounts={accounts}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : (
          <PanelEmpty
            text="No tienes tarjetas ni préstamos activos."
            href={DEBTS_PATH}
            action="Ir a Deudas"
            onNavigate={onCancel}
          />
        )}
      </div>
    )
  }

  if (panel === "receivable" && paymentTabs) {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        {paymentTabs.receivables.length > 0 ? (
          <ReceivableCollectForm
            workspaceId={workspaceId}
            receivables={paymentTabs.receivables}
            accounts={accounts}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : (
          <PanelEmpty
            text="No tienes cuentas por cobrar activas."
            href={RECEIVABLES_PATH}
            action="Ir a Me deben"
            onNavigate={onCancel}
          />
        )}
      </div>
    )
  }

  if (panel === "goal" && paymentTabs) {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        {paymentTabs.goals.length > 0 ? (
          <GoalContributionPanel
            workspaceId={workspaceId}
            goals={paymentTabs.goals}
            accounts={accounts}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : (
          <PanelEmpty
            text="No tienes metas activas."
            href={GOALS_PATH}
            action="Ir a Metas"
            onNavigate={onCancel}
          />
        )}
      </div>
    )
  }

  if (panel === "recurring" && paymentTabs) {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        {paymentTabs.pendingPayments.length > 0 ? (
          <RecurringPaymentPanel
            workspaceId={workspaceId}
            payments={paymentTabs.pendingPayments}
            categories={categories}
            accounts={accounts}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        ) : (
          <PanelEmpty
            text="No tienes gastos fijos pendientes de pago."
            href={RECURRING_PATH}
            action="Ir a Gastos fijos"
            onNavigate={onCancel}
          />
        )}
      </div>
    )
  }

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
          value={transaction.id}
        />
      )}
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="type"
        value={type}
      />
      {recurring && (
        <>
          <input
            type="hidden"
            name="recurring_expense_id"
            value={recurring.recurringExpenseId}
          />
          <input
            type="hidden"
            name="recurring_due_on"
            value={recurring.dueOn}
          />
        </>
      )}

      {typeToggle}

      {/* En Ingreso es el primer campo: prellena los siguientes */}
      {showIncomeSource && (
        <IncomeSourceField
          sources={incomeSources}
          value={incomeSourceId}
          onChange={handleIncomeSourceChange}
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
        value={amountText}
        onChange={(event) => setAmountText(event.target.value)}
        isRequired
        error={errors?.amount?.[0]}
      />
      {incomeSource && (
        <IncomeReceiptPreview
          source={incomeSource}
          amount={parsePaymentAmount(amountText) ?? 0}
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
          value={date}
          onChange={setDate}
          error={errors?.occurred_on?.[0]}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          help="common.time"
          value={time}
          onChange={setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <CategorySelectField
        name="category_id"
        value={categoryId}
        onChange={setCategoryId}
        categories={options}
        workspaceId={workspaceId}
        type={type}
        help="common.category"
        error={errors?.category_id?.[0]}
      >
        {initialCategoryUnavailable && !categoryId && (
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
          amount={parsePaymentAmount(amountText)}
          errors={{
            account_id: errors?.account_id?.[0],
            transfer_from: errors?.transfer_from?.[0],
            transfer_amount: errors?.transfer_amount?.[0]
          }}
          direction="out"
          defaultAccountId={accountId}
          onAccountChange={setAccountId}
        />
      ) : (
        <AccountSelectField
          workspaceId={workspaceId}
          name="account_id"
          label="Cuenta"
          help="common.account"
          value={accountId}
          onChange={setAccountId}
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
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        isRequired
        error={errors?.description?.[0]}
      />

      {isBusiness && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInputField
            name="counterparty"
            label={
              type === "income" ? "Cliente (opcional)" : "Proveedor (opcional)"
            }
            help="transaction.counterparty"
            maxLength={80}
            autoComplete="off"
            defaultValue={
              values?.counterparty ??
              transaction?.counterparty ??
              initialValues?.counterparty ??
              ""
            }
            error={errors?.counterparty?.[0]}
          />

          <TextInputField
            name="invoice_ref"
            label="N.º de factura (opcional)"
            help="transaction.invoice"
            maxLength={40}
            autoComplete="off"
            placeholder="FV-001"
            defaultValue={values?.invoice_ref ?? transaction?.invoice_ref ?? ""}
            error={errors?.invoice_ref?.[0]}
          />
        </div>
      )}

      <div
        className="flex flex-col gap-2"
        data-invalid={errors?.note ? true : undefined}
      >
        <FieldLabel
          htmlFor={noteId}
          help="common.note"
          isInvalid={Boolean(errors?.note)}
        >
          Nota (opcional)
        </FieldLabel>
        <Textarea
          id={noteId}
          name="note"
          rows={3}
          maxLength={500}
          defaultValue={
            values?.note ?? transaction?.note ?? initialValues?.note ?? ""
          }
          aria-invalid={errors?.note ? true : undefined}
          aria-describedby={errors?.note ? `${noteId}-error` : undefined}
        />
        {errors?.note ? (
          <FieldError id={`${noteId}-error`}>{errors.note[0]}</FieldError>
        ) : null}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}

interface RecurringPaymentPanelProps {
  workspaceId: string
  payments: UpcomingPayment[]
  categories: Category[]
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
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

/** Tab de pago sin nada que pagar: lleva a la página donde se crean */
function PanelEmpty({
  text,
  href,
  action,
  onNavigate
}: {
  text: string
  href: Route
  action: string
  /** Cierra el diálogo: el header no se desmonta al navegar */
  onNavigate: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        href={href}
        className={buttonVariants({ variant: "secondary" })}
        onClick={onNavigate}
      >
        {action}
      </Link>
    </div>
  )
}
