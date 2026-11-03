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
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import {
  AccountSelect,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { TransferForm } from "@/features/accounts/components/transfer-dialog"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
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
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransactionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = transaction !== undefined
  const isPayment = !isEditing && recurring !== undefined

  // `trigger` debe ser un Button de HeroUI: el Modal lo conecta por React Aria
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

interface TransactionFormProps {
  workspaceId: string
  workspaceType: WorkspaceType
  categories: Category[]
  accounts: PaymentAccountOption[]
  transaction?: EditableTransaction
  initialValues?: TransactionInitialValues
  recurring?: RecurringOccurrenceLink
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
  const [accountId, setAccountId] = useState(transaction?.account_id ?? "")
  const [amountText, setAmountText] = useState(() =>
    transaction
      ? AMOUNT_FORMAT.format(transaction.amount)
      : initialValues?.amount !== undefined
        ? AMOUNT_FORMAT.format(initialValues.amount)
        : ""
  )
  // Un movimiento nuevo y suelto también puede ser un traspaso entre dos
  // cuentas propias: se guarda en transfers y no cuenta como ingreso ni gasto
  const [isTransfer, setIsTransfer] = useState(false)
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
    if (value === "transfer") {
      setIsTransfer(true)
      return
    }
    setIsTransfer(false)
    if (value === type) return
    setType(value as TransactionType)
    setCategoryId("")
  }

  const errors = state.fieldErrors
  const values = state.values
  const showTransfer = !isEditing && type === "expense" && !isBusiness

  const typeToggle = (
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[isTransfer ? "transfer" : type]}
      onSelectionChange={handleTypeChange}
      isDisabled={isLinked}
      fullWidth
      aria-label="Tipo de movimiento"
    >
      <ToggleButton
        id="expense"
        className="flex-1"
      >
        {copy.expense}
      </ToggleButton>
      <ToggleButton
        id="income"
        className="flex-1"
      >
        {copy.income}
      </ToggleButton>
      {canTransfer && (
        <ToggleButton
          id="transfer"
          className="flex-1"
        >
          Traspaso
        </ToggleButton>
      )}
    </ToggleButtonGroup>
  )

  if (isTransfer) {
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

      <Select
        name="category_id"
        fullWidth
        placeholder="Elige una categoría"
        value={categoryId || null}
        onChange={(key) => setCategoryId(key == null ? "" : String(key))}
        isInvalid={Boolean(errors?.category_id)}
        className="flex flex-col gap-2"
      >
        <Label>Categoría</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((category) => {
              const name = category.archived_at
                ? `${category.name} (archivada)`
                : category.name
              return (
                <ListBox.Item
                  key={category.id}
                  id={category.id}
                  textValue={name}
                >
                  <CategoryBadge
                    name={name}
                    icon={category.icon}
                    color={category.color}
                  />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              )
            })}
          </ListBox>
        </Select.Popover>
        <FieldError>{errors?.category_id?.[0]}</FieldError>
        {initialCategoryUnavailable && !categoryId && (
          <p className="text-sm text-muted">
            La categoría de este gasto fijo está archivada. Elige otra.
          </p>
        )}
      </Select>

      {/* Un gasto nuevo de Personal puede traspasar fondos antes de pagar
          (SPEC 16). Al editar, y en ingresos o Empresa, solo se elige la
          cuenta: activas, más la actual del movimiento editado aunque esté
          archivada, para poder guardar sin cambiarla */}
      {showTransfer ? (
        <PaymentAccountSection
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
        <AccountSelect
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
