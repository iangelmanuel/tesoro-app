"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  buttonVariants,
  cn,
  toast
} from "@heroui/react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { TransferForm } from "@/features/accounts/components/transfer-dialog"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import type { Category } from "@/features/categories/queries"
import { DEBTS_PATH } from "@/features/debts/calculations"
import {
  type DebtOption,
  DebtPaymentPanel
} from "@/features/debts/components/payment-dialog"
import type { GoalOption } from "@/features/goals/components/contribution-dialog"
import {
  OccurrenceSelect,
  paymentKey,
  selectedPayment
} from "@/features/recurring-expenses/components/occurrence-select"
import type { UpcomingPayment } from "@/features/recurring-expenses/queries"
import { IncomeSourceField } from "@/features/recurring-incomes/components/income-source-field"
import { OTHER_INCOME } from "@/features/recurring-incomes/constants"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
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
    expense: "Gasto",
    income: "Ingreso",
    description: "Registra un ingreso o un gasto de tu espacio Personal.",
    placeholder: { expense: "Mercado de la semana", income: "Salario" }
  },
  business: {
    expense: "Costo o gasto",
    income: "Venta",
    description: "Registra una venta o un costo o gasto de tu empresa.",
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
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
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
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransactionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = transaction !== undefined
  const isPayment = !isEditing && recurring !== undefined
  // Empresa no tiene deudas ni gastos fijos; al editar o pagar una
  // ocurrencia concreta tampoco aplican
  const showPaymentTabs =
    paymentTabs !== undefined &&
    workspaceType === "personal" &&
    !isEditing &&
    !isPayment

  // `trigger` debe ser un Button de HeroUI: el Modal lo conecta por React Aria
  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog
            // Con 5 tabs el diálogo se ensancha un poco para que quepan
            className={showPaymentTabs ? "sm:max-w-lg" : "sm:max-w-md"}
          >
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing
                  ? "Editar movimiento"
                  : isPayment
                    ? "Registrar pago"
                    : "Nuevo movimiento"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos del movimiento."
                  : isPayment
                    ? "Confirma los datos del pago. Puedes ajustar el monto."
                    : COPY[workspaceType].description}
              </p>
            </Modal.Header>
            {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
            <Modal.Body>
              <TransactionForm
                workspaceId={workspaceId}
                workspaceType={workspaceType}
                categories={categories}
                accounts={accounts}
                transaction={transaction}
                initialValues={isEditing ? undefined : initialValues}
                recurring={isEditing ? undefined : recurring}
                paymentTabs={showPaymentTabs ? paymentTabs : undefined}
                incomeSources={
                  workspaceType === "personal" && !isPayment
                    ? (incomeSources ?? paymentTabs?.incomeSources)
                    : undefined
                }
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

/** Datos de los tabs de pago del diálogo (acceso rápido del header) */
export interface PaymentTabsData {
  /** Deudas activas: tarjetas y préstamos */
  debts: DebtOption[]
  /** Ocurrencias de gastos fijos sin pagar, vencidas primero */
  pendingPayments: UpcomingPayment[]
  /** Metas activas (tab "Meta") */
  goals: GoalOption[]
  /** Ingresos fijos activos (select "Ingreso fijo" del tab Ingreso) */
  incomeSources: IncomeSourceOption[]
}

/** Opciones del selector que no son un tipo de movimiento */
type FormPanel = "transfer" | "debt_payment" | "recurring"

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
  const [prefilled, setPrefilled] = useState(() =>
    initialValues?.recurring_income_id
      ? { amount: amountText, category: categoryId, account: accountId }
      : { amount: "", category: "", account: "" }
  )
  // Un movimiento nuevo y suelto también puede ser un traspaso entre dos
  // cuentas propias (se guarda en transfers y no cuenta como ingreso ni
  // gasto), un pago de deuda o el pago de un gasto fijo
  const [panel, setPanel] = useState<FormPanel | null>(null)
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
      toast.success(
        isEditing
          ? "Movimiento actualizado"
          : recurring
            ? "Pago registrado"
            : "Movimiento registrado"
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

  function handleTypeChange(keys: Set<React.Key>) {
    const [value] = [...keys]
    if (!value) return
    if (
      value === "transfer" ||
      value === "debt_payment" ||
      value === "recurring"
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

    const category = categories.find(
      (option) =>
        option.id === source.category_id &&
        option.type === "income" &&
        option.archived_at === null
    )
    const account = selectableAccounts(accounts).find(
      (option) => option.id === source.account_id
    )
    const next = {
      amount: AMOUNT_FORMAT.format(source.amount),
      category: category?.id ?? "",
      account: account?.id ?? ""
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
    setPrefilled(next)
  }

  const errors = state.fieldErrors
  const values = state.values
  const showIncomeSource =
    !isBusiness && type === "income" && incomeSources !== undefined
  const showTransfer = !isEditing && type === "expense" && !isBusiness

  const typeToggle = hideTypeToggle ? null : (
    // Con los tabs de pago son 5 opciones. Desde sm caben en el diálogo; en
    // un teléfono angosto se desplazan en horizontal, sin barra visible
    <div
      className={cn(
        paymentTabs &&
          "-mx-1 [scrollbar-width:none] overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
      )}
    >
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[panel ?? type]}
        onSelectionChange={handleTypeChange}
        isDisabled={isLinked}
        fullWidth
        aria-label="Tipo de movimiento"
        className={cn(paymentTabs && "w-max min-w-full")}
      >
        <ToggleButton
          id="expense"
          className="flex-1 whitespace-nowrap"
        >
          {copy.expense}
        </ToggleButton>
        <ToggleButton
          id="income"
          className="flex-1 whitespace-nowrap"
        >
          {copy.income}
        </ToggleButton>
        {canTransfer && (
          <ToggleButton
            id="transfer"
            className="flex-1 whitespace-nowrap"
          >
            Traspaso
          </ToggleButton>
        )}
        {paymentTabs && (
          <ToggleButton
            id="debt_payment"
            className="flex-1 whitespace-nowrap"
          >
            Deuda
          </ToggleButton>
        )}
        {paymentTabs && (
          <ToggleButton
            id="recurring"
            className="flex-1 whitespace-nowrap"
          >
            Gasto fijo
          </ToggleButton>
        )}
      </ToggleButtonGroup>
    </div>
  )

  if (panel === "transfer") {
    return (
      <div className="flex flex-col gap-4">
        {typeToggle}
        <p className="text-sm text-muted">
          Mueve plata entre tus cuentas. No cuenta como ingreso ni gasto.
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
              ? {
                  id: transaction.recurring_income_id,
                  dueOn: transaction.recurring_income_due_on
                }
              : null
          }
        />
      )}

      <TextField
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={setAmountText}
        isInvalid={Boolean(errors?.amount)}
        isRequired
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Monto</Label>
        <Input placeholder="0" />
        <FieldError>{errors?.amount?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          value={date}
          onChange={setDate}
          error={errors?.occurred_on?.[0]}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
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
        error={errors?.category_id?.[0]}
      >
        {initialCategoryUnavailable && !categoryId && (
          <p className="text-sm text-muted">
            La categoría de este gasto fijo está archivada. Elige otra.
          </p>
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
          defaultAccountId={accountId}
          onAccountChange={setAccountId}
        />
      ) : (
        <AccountSelectField
          workspaceId={workspaceId}
          name="account_id"
          label="Cuenta"
          value={accountId}
          onChange={setAccountId}
          accounts={selectableAccounts(accounts, transaction?.account_id)}
          allowNone
          error={errors?.account_id?.[0]}
        />
      )}

      <TextField
        name="description"
        maxLength={120}
        defaultValue={
          values?.description ??
          transaction?.description ??
          initialValues?.description
        }
        isInvalid={Boolean(errors?.description)}
        isRequired
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Descripción</Label>
        <Input placeholder={copy.placeholder[type]} />
        <FieldError>{errors?.description?.[0]}</FieldError>
      </TextField>

      {isBusiness && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="counterparty"
            maxLength={80}
            autoComplete="off"
            defaultValue={
              values?.counterparty ?? transaction?.counterparty ?? ""
            }
            isInvalid={Boolean(errors?.counterparty)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>
              {type === "income"
                ? "Cliente (opcional)"
                : "Proveedor (opcional)"}
            </Label>
            <Input />
            <FieldError>{errors?.counterparty?.[0]}</FieldError>
          </TextField>

          <TextField
            name="invoice_ref"
            maxLength={40}
            autoComplete="off"
            defaultValue={values?.invoice_ref ?? transaction?.invoice_ref ?? ""}
            isInvalid={Boolean(errors?.invoice_ref)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>N.º de factura (opcional)</Label>
            <Input placeholder="FV-001" />
            <FieldError>{errors?.invoice_ref?.[0]}</FieldError>
          </TextField>
        </div>
      )}

      <TextField
        name="note"
        maxLength={500}
        defaultValue={values?.note ?? transaction?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <TextArea rows={3} />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

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
          initialValues={{
            amount: selected.amount,
            category_id: selected.category.id,
            occurred_on: selected.dueOn,
            description: selected.name
          }}
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
  href: typeof DEBTS_PATH | typeof RECURRING_PATH
  action: string
  /** Cierra el diálogo: el header no se desmonta al navegar */
  onNavigate: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-sm text-muted">{text}</p>
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
