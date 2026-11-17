"use client"

import { useActionState, useState } from "react"
import {
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Tabs,
  TextField,
  toast
} from "@heroui/react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { activeAccountId } from "@/features/accounts/active-account"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { recordAdvance, recordPayment, updateEntry } from "../actions"
import type { DebtPaymentDescriptions } from "../payment-description"
import type { Debt, DebtEntry } from "../queries"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

type PaymentDebt = Pick<Debt, "id" | "kind"> & {
  /** Cuenta habitual (SPEC 41): se prellena al registrar si sigue activa */
  account_id?: string | null
  /** Descripción prellenada del movimiento (SPEC 41); sin ella, vacía */
  descriptions?: DebtPaymentDescriptions
}

/**
 * Campos de un pago o avance que el diálogo edita. Movimientos (SPEC 26) los
 * arma desde su fila sin cargar el abono completo. Cuenta, descripción y
 * categoría (SPEC 42) son opcionales: sin ellas el campo no se muestra y el
 * servidor conserva lo que hay
 */
export type EditableDebtEntry = Pick<
  DebtEntry,
  | "id"
  | "kind"
  | "amount"
  | "occurred_on"
  | "occurred_time"
  | "note"
  | "transaction_id"
  | "is_extra_payment"
> &
  Partial<Pick<DebtEntry, "payment_account_id" | "description" | "category_id">>

/** Pago del ciclo, abono extra o avance (solo tarjeta) */
type PaymentMode = "payment" | "extra" | "advance"

/** Deuda que se puede elegir en el diálogo (acceso rápido del header) */
export type DebtOption = Pick<Debt, "id" | "kind" | "name" | "account_id"> & {
  descriptions: DebtPaymentDescriptions
}

interface PaymentDialogProps {
  /** Espacio de la deuda (para crear una cuenta desde el select) */
  workspaceId: string
  /** Deuda fija. Sin ella, el diálogo deja elegir entre `debts` */
  debt?: PaymentDebt
  /** Deudas activas para elegir; se usa cuando no llega `debt` */
  debts?: DebtOption[]
  /** Si llega, el diálogo edita este pago o avance */
  entry?: EditableDebtEntry
  /** Cuentas con saldo para la cuenta del pago, al registrar y al editar */
  accounts?: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento de un pago editado */
  categories?: Category[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Pago de tarjeta o préstamo y avance de tarjeta. De una cuenta por cobrar
 * solo edita abonos: el cobro va por ReceivableCollectForm (SPEC 39)
 */
export function PaymentDialog({
  workspaceId,
  debt: fixedDebt,
  debts,
  entry,
  accounts = [],
  categories = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = entry !== undefined
  // Sin deuda fija arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(
    () => debts?.[0]?.id ?? ""
  )
  const debt: PaymentDebt | undefined =
    fixedDebt ?? debts?.find((option) => option.id === selectedDebtId)
  const kind = debt?.kind ?? "loan"
  const isAdvanceEntry = entry?.kind === "advance"
  const isFeeEntry = entry?.kind === "fee"
  const noun = isFeeEntry
    ? "cuota de manejo"
    : isAdvanceEntry
      ? "avance"
      : kind === "receivable" || entry?.is_extra_payment
        ? "abono"
        : "pago"

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
                {isEditing ? `Editar ${noun}` : `Registrar ${noun}`}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isFeeEntry
                  ? "Lo que el banco cobró a la tarjeta. No toca tus cuentas."
                  : isEditing && entry.transaction_id
                    ? "El movimiento enlazado se actualiza con estos cambios."
                    : kind === "receivable"
                      ? "Lo que te pagaron de esta cuenta por cobrar."
                      : "Lo que pagaste de esta deuda."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              {!fixedDebt && debts && !isEditing && (
                <DebtSelect
                  debts={debts}
                  value={selectedDebtId}
                  onChange={setSelectedDebtId}
                />
              )}
              {debt && (
                <PaymentForm
                  // Cambiar de deuda reinicia el formulario (tipo y textos)
                  key={debt.id}
                  workspaceId={workspaceId}
                  debt={debt}
                  entry={entry}
                  accounts={accounts}
                  categories={categories}
                  onSaved={() => setOpen(false)}
                  onCancel={() => setOpen(false)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

interface DebtPaymentPanelProps {
  workspaceId: string
  /** Deudas activas para elegir (tarjetas y préstamos) */
  debts: DebtOption[]
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Elegir deuda + formulario de pago, sin el Modal: tab "Pago de deuda" del
 * diálogo de movimiento. Mismo resultado que PaymentDialog desde "Más"
 */
export function DebtPaymentPanel({
  workspaceId,
  debts,
  accounts,
  onSaved,
  onCancel
}: DebtPaymentPanelProps) {
  // Arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(() => debts[0]?.id ?? "")
  const debt = debts.find((option) => option.id === selectedDebtId)

  return (
    <div>
      <DebtSelect
        debts={debts}
        value={selectedDebtId}
        onChange={setSelectedDebtId}
      />
      {debt && (
        <PaymentForm
          // Cambiar de deuda reinicia el formulario (tipo y textos)
          key={debt.id}
          workspaceId={workspaceId}
          debt={debt}
          accounts={accounts}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function DebtSelect({
  debts,
  value,
  onChange
}: {
  debts: DebtOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      fullWidth
      placeholder="Elige una deuda"
      value={value || null}
      onChange={(key) => onChange(key == null ? "" : String(key))}
      className="mb-4 flex flex-col gap-2"
    >
      <Label>Deuda</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {debts.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.name}
            >
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

interface PaymentFormProps {
  workspaceId: string
  debt: PaymentDebt
  entry?: EditableDebtEntry
  accounts: PaymentAccountOption[]
  categories?: Category[]
  onSaved: () => void
  onCancel: () => void
}

// Un abono baja el saldo, pero el mínimo o la cuota del mes sigue pendiente
const EXTRA_EFFECT =
  "No cubre el pago del mes: el próximo pago sigue pendiente."

// Efecto real del pago, abono o avance de una tarjeta según la cuenta elegida
function cardEffect(mode: PaymentMode, accountName: string | null) {
  if (mode === "advance") {
    return accountName
      ? `Entra dinero a ${accountName} como ingreso (Avance de tarjeta) y sube la deuda de la tarjeta.`
      : "El avance no toca tus cuentas: solo sube el saldo de la tarjeta."
  }
  const effect = accountName
    ? `Mueve dinero de ${accountName} a la tarjeta. No cuenta como gasto.`
    : `Este ${mode === "extra" ? "abono" : "pago"} no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son gasto.`
  return mode === "extra" ? `${effect} ${EXTRA_EFFECT}` : effect
}

function initialMode(entry: EditableDebtEntry | undefined): PaymentMode {
  if (entry?.kind === "advance") return "advance"
  return entry?.is_extra_payment ? "extra" : "payment"
}

function PaymentForm({
  workspaceId,
  debt,
  entry,
  accounts,
  categories = [],
  onSaved,
  onCancel
}: PaymentFormProps) {
  const isEditing = entry !== undefined
  const isReceivable = debt.kind === "receivable"
  const isCard = debt.kind === "credit_card"
  const [mode, setMode] = useState<PaymentMode>(() => initialMode(entry))
  const isAdvance = mode === "advance"
  const isExtra = mode === "extra"
  const isFee = entry?.kind === "fee"
  // Pago / Abono en tarjetas y préstamos, también al editar un pago; el
  // avance solo se elige al registrar en una tarjeta
  const canBeExtra = !isReceivable && (!isEditing || entry?.kind === "payment")
  const canAdvance = isCard && !isEditing
  const [occurredOn, setOccurredOn] = useState(
    () => entry?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => entry?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateEntry(prevState, formData)
      : isAdvance
        ? await recordAdvance(prevState, formData)
        : await recordPayment(prevState, formData)

    if (result.ok) {
      const noun = isAdvance
        ? "Avance"
        : isReceivable || isExtra
          ? "Abono"
          : "Pago"
      toast.success(
        isFee
          ? "Cuota actualizada"
          : isEditing
            ? `${noun} actualizado`
            : `${noun} registrado`
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [amountText, setAmountText] = useState(
    () => values?.amount ?? amountInput(entry?.amount)
  )
  const [createTransaction, setCreateTransaction] = useState(
    () => !values || values.create_transaction === "on"
  )
  // Cuenta habitual de la deuda al registrar, si sigue activa (SPEC 41)
  const defaultAccountId = isEditing
    ? ""
    : (activeAccountId(accounts, debt.account_id) ?? "")
  const [accountId, setAccountId] = useState(defaultAccountId)
  // Descripción del movimiento (SPEC 41): se prellena según Pago o Abono y
  // se respeta lo que el usuario escriba
  const [description, setDescription] = useState(
    () =>
      values?.description ??
      debt.descriptions?.[isExtra ? "extra" : "payment"] ??
      ""
  )
  const [prefilledDescription, setPrefilledDescription] = useState(description)
  function changeMode(next: PaymentMode) {
    setMode(next)
    if (description === "" || description === prefilledDescription) {
      const text = debt.descriptions?.[next === "extra" ? "extra" : "payment"]
      if (text === undefined) return
      setDescription(text)
      setPrefilledDescription(text)
    }
  }
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null

  // Al registrar, la cuenta va con el traspaso previo
  const showAccount = !isEditing && (isCard || createTransaction)

  // Al editar (SPEC 42): la cuenta vive en el pago de una tarjeta o en el
  // movimiento; descripción y categoría solo existen con movimiento. Sin el
  // dato del abono, el campo no se muestra y se conserva
  const hasTransaction = Boolean(entry?.transaction_id)
  const editsPayment =
    isEditing && (entry.kind === "payment" || entry.kind === "advance")
  const showEditAccount =
    editsPayment &&
    entry.payment_account_id !== undefined &&
    ((isCard && entry.kind === "payment") || hasTransaction)
  const showEditDescription =
    editsPayment && hasTransaction && entry.description !== undefined
  const showEditCategory =
    editsPayment && hasTransaction && entry.category_id !== undefined
  const [editAccountId, setEditAccountId] = useState(
    () => values?.account_id ?? entry?.payment_account_id ?? ""
  )
  const [categoryId, setCategoryId] = useState(
    () => values?.category_id ?? entry?.category_id ?? ""
  )
  // Préstamo: gasto. Cobro de Me deben y avance de tarjeta: ingreso
  const transactionType: Category["type"] =
    isReceivable || isAdvance ? "income" : "expense"
  const categoryOptions = categories.filter(
    (category) =>
      category.type === transactionType &&
      (category.archived_at === null || category.id === entry?.category_id)
  )
  const editAccountName =
    accounts.find((account) => account.id === editAccountId)?.name ?? null

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
          value={entry.id}
        />
      ) : (
        <input
          type="hidden"
          name="debt_id"
          value={debt.id}
        />
      )}

      {canBeExtra && (
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => changeMode(key as PaymentMode)}
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label={
                isCard ? "Tipo de movimiento de la tarjeta" : "Tipo de pago"
              }
            >
              <Tabs.Tab id="payment">
                Pago
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="extra">
                Abono
                <Tabs.Indicator />
              </Tabs.Tab>
              {canAdvance && (
                <Tabs.Tab id="advance">
                  Avance
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}

      {canBeExtra && (
        <input
          type="hidden"
          name="is_extra_payment"
          value={isExtra ? "true" : "false"}
        />
      )}

      <TextField
        name="amount"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        onChange={setAmountText}
        isRequired
        isInvalid={Boolean(errors?.amount)}
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
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
          isRequired
        />

        <TimePickerField
          name="occurred_time"
          value={time}
          onChange={setTime}
          error={errors?.occurred_time?.[0]}
        />
      </div>

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? entry?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input
          placeholder={
            isAdvance
              ? "Avance en cajero"
              : isReceivable
                ? "Primer abono"
                : isExtra
                  ? "Abono a capital"
                  : "Cuota de noviembre"
          }
        />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {/* El movimiento solo se crea al registrar; al editar, el trigger
          sincroniza el que ya existe */}
      {!isEditing && !isCard && (
        <Checkbox
          name="create_transaction"
          value="on"
          isSelected={createTransaction}
          onChange={setCreateTransaction}
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content className="text-sm">
            {isReceivable ? "Registrar como ingreso" : "Registrar como gasto"}
          </Checkbox.Content>
        </Checkbox>
      )}

      {showEditDescription && (
        <TextField
          name="description"
          maxLength={120}
          defaultValue={values?.description ?? entry?.description ?? ""}
          isInvalid={Boolean(errors?.description)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Descripción</Label>
          <Input placeholder={isReceivable ? "Cobro" : "Pago de la cuota"} />
          <FieldError>{errors?.description?.[0]}</FieldError>
        </TextField>
      )}

      {showEditCategory && (
        <CategorySelectField
          name="category_id"
          value={categoryId}
          onChange={setCategoryId}
          categories={categoryOptions}
          workspaceId={workspaceId}
          type={transactionType}
          error={errors?.category_id?.[0]}
        />
      )}

      {showEditAccount && (
        <AccountSelectField
          workspaceId={workspaceId}
          name="account_id"
          label={
            isAdvance || isReceivable ? "Cuenta que recibe" : "Cuenta que paga"
          }
          value={editAccountId}
          onChange={setEditAccountId}
          accounts={selectableAccounts(accounts, entry?.payment_account_id)}
          allowNone
          error={errors?.account_id?.[0]}
        />
      )}

      {/* Solo con movimiento: una tarjeta o un avance no crean uno */}
      {!isEditing && !isCard && createTransaction && (
        <TextField
          name="description"
          maxLength={120}
          value={description}
          onChange={setDescription}
          isInvalid={Boolean(errors?.description)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Descripción</Label>
          <Input placeholder={isReceivable ? "Cobro" : "Pago de la cuota"} />
          <FieldError>{errors?.description?.[0]}</FieldError>
        </TextField>
      )}

      {/* En préstamos y cuentas por cobrar la cuenta es la del movimiento: sin
          él no aplica. El avance no lleva traspaso y un abono es un ingreso */}
      {showAccount && (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={parsePaymentAmount(amountText)}
          errors={{
            account_id: errors?.account_id?.[0],
            transfer_from: errors?.transfer_from?.[0],
            transfer_amount: errors?.transfer_amount?.[0]
          }}
          label={
            isAdvance || isReceivable ? "Cuenta que recibe" : "Cuenta que paga"
          }
          direction={isAdvance || isReceivable ? "in" : "out"}
          defaultAccountId={defaultAccountId}
          onAccountChange={setAccountId}
        />
      )}

      {!isEditing && isCard && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, accountName)}
        </p>
      )}

      {isCard && showEditAccount && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, editAccountName)}
        </p>
      )}

      {/* Con cuenta, el texto de la tarjeta ya explica el abono */}
      {isExtra && (!isCard || (isEditing && !showEditAccount)) && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          Baja el saldo de la deuda. {EXTRA_EFFECT}
        </p>
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}
