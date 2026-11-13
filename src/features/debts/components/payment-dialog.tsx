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
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { recordAdvance, recordPayment, updateEntry } from "../actions"
import { formatMonthYear } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

type PaymentDebt = Pick<Debt, "id" | "kind">

/**
 * Campos de un pago o avance que el diálogo edita. Movimientos (SPEC 26) los
 * arma desde su fila sin cargar el abono completo
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
>

/** Pago del ciclo, abono extra o avance (solo tarjeta) */
type PaymentMode = "payment" | "extra" | "advance"

/**
 * Cuota de una cuenta por cobrar mensual que se cobra con "Marcar pagada" o
 * "Abonar" (SPEC 28 y 29): el mes (YYYY-MM-01) y lo que falta para prellenar
 */
export interface CollectedInstallment {
  period_on: string
  amount: number | null
  /** Ya tiene abonos: el cobro es otro abono */
  partial?: boolean
}

/** Deuda que se puede elegir en el diálogo (acceso rápido del header) */
export type DebtOption = Pick<Debt, "id" | "kind" | "name">

interface PaymentDialogProps {
  /** Espacio de la deuda (para crear una cuenta desde el select) */
  workspaceId: string
  /** Deuda fija. Sin ella, el diálogo deja elegir entre `debts` */
  debt?: PaymentDebt
  /** Deudas activas para elegir; se usa cuando no llega `debt` */
  debts?: DebtOption[]
  /** Si llega, el diálogo edita este pago o avance */
  entry?: EditableDebtEntry
  /** Cuentas con saldo para la cuenta del pago; solo al registrar */
  accounts?: PaymentAccountOption[]
  /** Cuota que se cobra (cuenta por cobrar mensual); solo al registrar */
  installment?: CollectedInstallment
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Pago de tarjeta o préstamo, abono de una cuenta por cobrar y avance de
 * tarjeta
 */
export function PaymentDialog({
  workspaceId,
  debt: fixedDebt,
  debts,
  entry,
  accounts = [],
  installment,
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
                {installment
                  ? installment.partial
                    ? "Abonar a la cuota"
                    : "Marcar cuota pagada"
                  : isEditing
                    ? `Editar ${noun}`
                    : `Registrar ${noun}`}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {installment
                  ? `Cuota de ${formatMonthYear(installment.period_on.slice(0, 7))}. Si te pagaron menos, queda abonada y sigue debiendo la diferencia.`
                  : isFeeEntry
                    ? "Lo que el banco cobró a la tarjeta. No toca tus cuentas."
                    : isEditing && entry.transaction_id
                      ? "El movimiento enlazado se actualiza con el monto y la fecha."
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
                  installment={isEditing ? undefined : installment}
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
  installment?: CollectedInstallment
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
      ? `Entra dinero a ${accountName} y sube la deuda de la tarjeta. No cuenta como ingreso.`
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
  installment,
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
        installment
          ? "Cobro de la cuota registrado"
          : isFee
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
    () => values?.amount ?? amountInput(entry?.amount ?? installment?.amount)
  )
  const [createTransaction, setCreateTransaction] = useState(
    () => !values || values.create_transaction === "on"
  )
  const [accountId, setAccountId] = useState("")
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null

  // La cuenta se elige al registrar; al editar solo cambian monto, fecha y nota
  const showAccount = !isEditing && (isCard || createTransaction)

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

      {installment && (
        <input
          type="hidden"
          name="period_on"
          value={installment.period_on}
        />
      )}

      {canBeExtra && (
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => setMode(key as PaymentMode)}
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
          onAccountChange={setAccountId}
        />
      )}

      {!isEditing && isCard && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, accountName)}
        </p>
      )}

      {(isEditing || !isCard) && isExtra && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          Baja el saldo de la deuda. {EXTRA_EFFECT}
        </p>
      )}

      {(state.error ?? errors?.period_on?.[0]) && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error ?? errors?.period_on?.[0]}
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
