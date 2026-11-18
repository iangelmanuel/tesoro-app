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
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { activeAccountId } from "@/features/accounts/active-account"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { recordAdvance, recordPayment } from "../actions"
import { MAX_INSTALLMENTS } from "../installments"
import type { DebtPaymentDescriptions } from "../payment-description"
import type { Debt } from "../queries"
import type { PaymentFormState } from "../types"

type PaymentDebt = Pick<Debt, "id" | "kind"> & {
  /** Cuenta habitual (SPEC 41): se prellena al registrar si sigue activa */
  account_id?: string | null
  /** Descripción prellenada del movimiento (SPEC 41); sin ella, vacía */
  descriptions?: DebtPaymentDescriptions
}

/** Pago del ciclo, abono extra o compra o avance (solo tarjeta) */
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
                {kind === "receivable" ? "Registrar abono" : "Registrar pago"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {kind === "receivable"
                  ? "Lo que te pagaron de esta cuenta por cobrar."
                  : "Lo que pagaste de esta deuda."}
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
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

// Un abono baja el saldo, pero el mínimo o la cuota del mes sigue pendiente
const EXTRA_EFFECT =
  "No cubre el pago del mes: el próximo pago sigue pendiente."

// Efecto real del pago, abono o compra o avance de una tarjeta según la
// cuenta elegida
function cardEffect(mode: PaymentMode, accountName: string | null) {
  if (mode === "advance") {
    return accountName
      ? `Es un avance: entra dinero a ${accountName} como ingreso (Avance de tarjeta) y sube la deuda de la tarjeta.`
      : "Es una compra: no toca tus cuentas, solo sube el saldo de la tarjeta. Si es a cuotas, cada cuota suma al pago del mes."
  }
  const effect = accountName
    ? `Mueve dinero de ${accountName} a la tarjeta. No cuenta como gasto.`
    : `Este ${mode === "extra" ? "abono" : "pago"} no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son gasto.`
  return mode === "extra" ? `${effect} ${EXTRA_EFFECT}` : effect
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
  const [mode, setMode] = useState<PaymentMode>("payment")
  const isAdvance = mode === "advance"
  const isExtra = mode === "extra"
  const canBeExtra = !isReceivable
  const [occurredOn, setOccurredOn] = useState(() => todayISO())
  const [time, setTime] = useState("")

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isAdvance
      ? await recordAdvance(prevState, formData)
      : await recordPayment(prevState, formData)

    if (result.ok) {
      toast.success(
        isAdvance
          ? formData.get("account_id")
            ? "Avance registrado"
            : "Compra registrada"
          : isReceivable || isExtra
            ? "Abono registrado"
            : "Pago registrado"
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [amountText, setAmountText] = useState(() => values?.amount ?? "")
  const [createTransaction, setCreateTransaction] = useState(
    () => !values || values.create_transaction === "on"
  )
  // Cuenta habitual de la deuda, si sigue activa (SPEC 41)
  const defaultAccountId = activeAccountId(accounts, debt.account_id) ?? ""
  const [accountId, setAccountId] = useState(defaultAccountId)
  // Descripción del movimiento (SPEC 41): se prellena según Pago o Abono y
  // se respeta lo que el usuario escriba
  const [description, setDescription] = useState(
    () => values?.description ?? debt.descriptions?.payment ?? ""
  )
  const [prefilledDescription, setPrefilledDescription] = useState(description)
  function changeMode(next: PaymentMode) {
    setMode(next)
    // Una compra o avance arranca sin cuenta (compra): la cuenta habitual es
    // la que paga la tarjeta, no la que recibe un avance
    if ((next === "advance") !== (mode === "advance")) {
      setAccountId(next === "advance" ? "" : defaultAccountId)
    }
    if (description === "" || description === prefilledDescription) {
      const text = debt.descriptions?.[next === "extra" ? "extra" : "payment"]
      if (text === undefined) return
      setDescription(text)
      setPrefilledDescription(text)
    }
  }
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null
  const showAccount = isCard || createTransaction

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
              {isCard && (
                <Tabs.Tab id="advance">
                  Compra
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

      {isAdvance && (
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
          <Label>Cuotas (opcional)</Label>
          <Input placeholder={`1 a ${MAX_INSTALLMENTS}`} />
          <FieldError>{errors?.installments?.[0]}</FieldError>
        </TextField>
      )}

      <TextField
        name="note"
        maxLength={120}
        defaultValue={values?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input
          placeholder={
            isAdvance
              ? "Compra en el supermercado"
              : isReceivable
                ? "Primer abono"
                : isExtra
                  ? "Abono a capital"
                  : "Cuota de noviembre"
          }
        />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      {!isCard && (
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

      {/* Solo con movimiento: una tarjeta no crea uno */}
      {!isCard && createTransaction && (
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
          // Cambiar entre pago y compra o avance reinicia la cuenta
          key={isAdvance ? "charge" : "payment"}
          defaultAccountId={isAdvance ? "" : defaultAccountId}
          onAccountChange={setAccountId}
        />
      )}

      {isCard && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, accountName)}
        </p>
      )}

      {isExtra && !isCard && (
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
          {pending ? "Guardando..." : "Registrar"}
        </Button>
      </div>
    </form>
  )
}
