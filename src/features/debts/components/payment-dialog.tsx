"use client"

import { useActionState, useState } from "react"
import {
  Button,
  Checkbox,
  FieldError,
  Input,
  ListBox,
  Modal,
  Select,
  Tabs,
  TextField,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp, FieldLabel } from "@/components/forms/field-label"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { activeAccountId } from "@/features/accounts/active-account"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { recordAdvance, recordDebtCharge, recordPayment } from "../actions"
import {
  type AdjustmentDirection,
  type EntryType,
  entryTypeInfo,
  entryTypesFor
} from "../entry-types"
import { MAX_INSTALLMENTS } from "../installments"
import type { DebtPaymentDescriptions } from "../payment-description"
import type { Debt } from "../queries"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

type PaymentDebt = Pick<Debt, "id" | "kind"> & {
  /** Cuenta por defecto (SPEC 41): se prellena al registrar si sigue activa */
  account_id?: string | null
  /** Descripción prellenada del movimiento (SPEC 41); sin ella, vacía */
  descriptions?: DebtPaymentDescriptions
}

/**
 * Tipo del movimiento nuevo (SPEC 46): los mismos del editor (SPEC 42).
 * Pago y Abono van por recordPayment, Compra y Avance por recordAdvance, y
 * Cuota de manejo y Ajuste por recordDebtCharge
 */
type PaymentMode = EntryType

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
  /** Cuentas con saldo para la cuenta del pago */
  accounts?: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Registrar un pago o abono de tarjeta o préstamo, o una compra o avance de
 * tarjeta. El cobro de una cuenta por cobrar va por ReceivableCollectForm
 * (SPEC 39) y editar cualquier movimiento de una deuda, por
 * DebtEntryDialog (SPEC 42)
 */
export function PaymentDialog({
  workspaceId,
  debt: fixedDebt,
  debts,
  accounts = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  // Sin deuda fija arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(
    () => debts?.[0]?.id ?? ""
  )
  const debt: PaymentDebt | undefined =
    fixedDebt ?? debts?.find((option) => option.id === selectedDebtId)
  const kind = debt?.kind ?? "loan"

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
                {kind === "receivable"
                  ? "Registrar abono"
                  : "Registrar movimiento"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {kind === "receivable"
                  ? "Lo que te pagaron de esta cuenta por cobrar."
                  : "Un pago, abono, compra, cargo o ajuste de esta deuda."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              {!fixedDebt && debts && (
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
                  accounts={accounts}
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
      <FieldLabel help="debtEntry.debt">Deuda</FieldLabel>
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
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

// Un abono baja el saldo, pero el mínimo o la cuota del mes sigue pendiente
const EXTRA_EFFECT =
  "No cubre el pago del mes: el próximo pago sigue pendiente."

const TOASTS: Record<PaymentMode, string> = {
  payment: "Pago registrado",
  extra: "Abono registrado",
  purchase: "Compra registrada",
  advance: "Avance registrado",
  fee: "Cuota de manejo registrada",
  adjustment: "Ajuste registrado"
}

// Efecto real del movimiento en una tarjeta según el tipo y la cuenta
function cardEffect(mode: PaymentMode, accountName: string | null) {
  switch (mode) {
    case "purchase":
      return "Es una compra: no toca tus cuentas, solo sube el saldo de la tarjeta. Si es a cuotas, cada cuota suma al pago del mes."
    case "advance":
      return accountName
        ? `Es un avance: entra dinero a ${accountName} como entrada (Avance de tarjeta) y sube la deuda de la tarjeta.`
        : "Elige la cuenta a la que entró el avance."
    case "fee":
      return "Sube el saldo de la tarjeta. No toca tus cuentas."
    case "adjustment":
      return "Corrige el saldo de la tarjeta. No toca tus cuentas ni crea movimiento."
    default: {
      const effect = accountName
        ? `Mueve dinero de ${accountName} a la tarjeta. No cuenta como salida.`
        : `Este ${mode === "extra" ? "abono" : "pago"} no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son salidas.`
      return mode === "extra" ? `${effect} ${EXTRA_EFFECT}` : effect
    }
  }
}

function PaymentForm({
  workspaceId,
  debt,
  accounts,
  onSaved,
  onCancel
}: PaymentFormProps) {
  const isReceivable = debt.kind === "receivable"
  const isCard = debt.kind === "credit_card"
  // Los mismos tipos del editor (SPEC 42). Una cuenta por cobrar llega aquí
  // solo para abonar: su cobro va por ReceivableCollectForm
  const types: PaymentMode[] = isReceivable
    ? ["payment"]
    : entryTypesFor({ kind: debt.kind, schedule: null })
  const [mode, setMode] = useState<PaymentMode>("payment")
  const isPayment = mode === "payment" || mode === "extra"
  const isCharge = mode === "purchase" || mode === "advance"
  const isExtra = mode === "extra"
  const [occurredOn, setOccurredOn] = useState(() => todayISO())
  const [time, setTime] = useState("")
  const [direction, setDirection] = useState<AdjustmentDirection>("up")

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isCharge
      ? await recordAdvance(prevState, formData)
      : isPayment
        ? await recordPayment(prevState, formData)
        : await recordDebtCharge(prevState, formData)

    if (result.ok) {
      toast.success(isReceivable ? "Abono registrado" : TOASTS[mode])
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  // Monto (SPEC 41): el Pago arranca con lo que falta de la cuota; los demás
  // tipos, vacíos. Se respeta lo que el usuario escriba
  const amountFor = (next: PaymentMode) =>
    next === "payment" ? amountInput(debt.descriptions?.amount) : ""
  const [amountText, setAmountText] = useState(
    () => values?.amount ?? amountFor("payment")
  )
  const [prefilledAmount, setPrefilledAmount] = useState(amountText)
  const [createTransaction, setCreateTransaction] = useState(
    () => !values || values.create_transaction === "on"
  )
  // Cuenta por defecto de la deuda, si sigue activa (SPEC 41)
  const defaultAccountId = activeAccountId(accounts, debt.account_id) ?? ""
  const [accountId, setAccountId] = useState(defaultAccountId)
  // Descripción del movimiento (SPEC 41): se prellena según Pago o Abono y
  // se respeta lo que el usuario escriba
  const descriptionFor = (next: PaymentMode) =>
    debt.descriptions?.[next === "extra" ? "extra" : "payment"]
  const [description, setDescription] = useState(
    () => values?.description ?? descriptionFor("payment") ?? ""
  )
  const [prefilledDescription, setPrefilledDescription] = useState(description)
  // Nota del movimiento en el historial de la deuda: en Pago y Abono, el
  // mismo texto que la descripción ("Pago {nombre} · {mes}"); en una tarjeta
  // es el único texto del pago. Los demás tipos arrancan vacíos
  const noteFor = (next: PaymentMode) =>
    next === "payment" || next === "extra" ? (descriptionFor(next) ?? "") : ""
  const [note, setNote] = useState(() => values?.note ?? noteFor("payment"))
  const [prefilledNote, setPrefilledNote] = useState(note)
  function changeMode(next: PaymentMode) {
    setMode(next)
    // El avance arranca sin cuenta: la cuenta por defecto es la que paga la
    // tarjeta, no la que recibe un avance
    if ((next === "advance") !== (mode === "advance")) {
      setAccountId(next === "advance" ? "" : defaultAccountId)
    }
    if (amountText === "" || amountText === prefilledAmount) {
      const amount = amountFor(next)
      setAmountText(amount)
      setPrefilledAmount(amount)
    }
    if (note === "" || note === prefilledNote) {
      const text = noteFor(next)
      setNote(text)
      setPrefilledNote(text)
    }
    if (description === "" || description === prefilledDescription) {
      const text = descriptionFor(next)
      if (text === undefined) return
      setDescription(text)
      setPrefilledDescription(text)
    }
  }
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null
  // Pago o abono: en tarjeta, la cuenta que paga; en préstamo, la del
  // movimiento. Avance: la que recibe. Compra, cuota y ajuste no tocan cuentas
  const showAccount =
    (isPayment && (isCard || createTransaction)) || mode === "advance"

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="debt_id"
        value={debt.id}
      />
      <input
        type="hidden"
        name="type"
        value={mode}
      />

      {types.length > 1 && (
        <Select
          fullWidth
          value={mode}
          onChange={(key) => {
            if (key == null) return
            changeMode(key as PaymentMode)
          }}
          isInvalid={Boolean(errors?.type)}
          className="flex flex-col gap-2"
        >
          <FieldLabel help="debtEntry.type">Tipo</FieldLabel>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {types.map((option) => {
                const info = entryTypeInfo(option, debt.kind)
                return (
                  <ListBox.Item
                    key={option}
                    id={option}
                    textValue={info.label}
                  >
                    <span className="flex flex-col py-0.5">
                      <span className="text-sm font-medium">{info.label}</span>
                      <span className="text-xs text-muted">{info.hint}</span>
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                )
              })}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.type?.[0]}</FieldError>
        </Select>
      )}

      {isPayment && !isReceivable && (
        <input
          type="hidden"
          name="is_extra_payment"
          value={isExtra ? "true" : "false"}
        />
      )}

      {mode === "adjustment" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-0.5">
            <p className="text-sm font-medium">El ajuste</p>
            <FieldHelp
              help="debtEntry.direction"
              label="El ajuste"
            />
          </div>
          <Tabs
            selectedKey={direction}
            onSelectionChange={(key) =>
              setDirection(key as AdjustmentDirection)
            }
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="El ajuste sube o baja el saldo">
                <Tabs.Tab id="up">
                  Sube
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="down">
                  Baja
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <input
            type="hidden"
            name="direction"
            value={direction}
          />
        </div>
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
        <FieldLabel help="common.amount">Monto</FieldLabel>
        <Input placeholder="0" />
        <FieldError>{errors?.amount?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 md:grid-cols-2">
        <DatePickerField
          name="occurred_on"
          label="Fecha"
          help="common.date"
          value={occurredOn}
          onChange={setOccurredOn}
          error={errors?.occurred_on?.[0]}
          maxValue={todayISO()}
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

      {isCharge && (
        <TextField
          name="installments"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          defaultValue={values?.installments ?? ""}
          isInvalid={Boolean(errors?.installments)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <FieldLabel help="debtEntry.installments">
            Cuotas (opcional)
          </FieldLabel>
          <Input placeholder={`1 a ${MAX_INSTALLMENTS}`} />
          <FieldError>{errors?.installments?.[0]}</FieldError>
        </TextField>
      )}

      <TextField
        name="note"
        maxLength={120}
        value={note}
        onChange={setNote}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <FieldLabel help="common.note">Nota (opcional)</FieldLabel>
        <Input placeholder={notePlaceholder(mode, isReceivable)} />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {!isCard && isPayment && (
        <div className="flex items-center gap-0.5">
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
              {isReceivable
                ? "Registrar como entrada"
                : "Registrar como salida"}
            </Checkbox.Content>
          </Checkbox>
          <FieldHelp
            help="debtEntry.createTransaction"
            label="Registrar el movimiento"
          />
        </div>
      )}

      {/* Solo con movimiento: una tarjeta no crea uno */}
      {!isCard && isPayment && createTransaction && (
        <TextField
          name="description"
          maxLength={120}
          value={description}
          onChange={setDescription}
          isInvalid={Boolean(errors?.description)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <FieldLabel help="common.description">Descripción</FieldLabel>
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
            mode === "advance" || isReceivable
              ? "Cuenta que recibe"
              : "Cuenta que paga"
          }
          direction={mode === "advance" || isReceivable ? "in" : "out"}
          // Cambiar entre pago y avance reinicia la cuenta
          key={mode === "advance" ? "advance" : "payment"}
          defaultAccountId={mode === "advance" ? "" : defaultAccountId}
          onAccountChange={setAccountId}
        />
      )}

      {isCard ? (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, accountName)}
        </p>
      ) : isExtra ? (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          Baja el saldo de la deuda. {EXTRA_EFFECT}
        </p>
      ) : mode === "adjustment" ? (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          Corrige el saldo de la deuda. No toca tus cuentas ni crea movimiento.
        </p>
      ) : null}

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
          {pending ? "Guardando..." : "Registrar"}
        </Button>
      </div>
    </form>
  )
}

function notePlaceholder(mode: PaymentMode, isReceivable: boolean) {
  if (isReceivable) return "Primer abono"
  switch (mode) {
    case "purchase":
      return "Compra en el supermercado"
    case "advance":
      return "Avance en cajero"
    case "fee":
      return "Cuota de manejo de noviembre"
    case "adjustment":
      return "Intereses del extracto"
    case "extra":
      return "Abono a capital"
    default:
      return "Cuota de noviembre"
  }
}
