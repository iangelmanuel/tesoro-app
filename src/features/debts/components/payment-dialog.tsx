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
import type { Debt, DebtEntry } from "../queries"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

type PaymentDebt = Pick<Debt, "id" | "kind">

type PaymentMode = "payment" | "advance"

/** Deuda que se puede elegir en el diálogo (acceso rápido del header) */
export type DebtOption = Pick<Debt, "id" | "kind" | "name">

interface PaymentDialogProps {
  /** Deuda fija. Sin ella, el diálogo deja elegir entre `debts` */
  debt?: PaymentDebt
  /** Deudas activas para elegir; se usa cuando no llega `debt` */
  debts?: DebtOption[]
  /** Si llega, el diálogo edita este pago o avance */
  entry?: DebtEntry
  /** Cuentas con saldo para la cuenta del pago; solo al registrar */
  accounts?: PaymentAccountOption[]
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
  debt: fixedDebt,
  debts,
  entry,
  accounts = [],
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
      : kind === "receivable"
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
                  debt={debt}
                  entry={entry}
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
  debt: PaymentDebt
  entry?: DebtEntry
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

// Efecto real del pago o avance de una tarjeta según la cuenta elegida
function cardEffect(mode: PaymentMode, accountName: string | null) {
  if (mode === "advance") {
    return accountName
      ? `Entra dinero a ${accountName} y sube la deuda de la tarjeta. No cuenta como ingreso.`
      : "El avance no toca tus cuentas: solo sube el saldo de la tarjeta."
  }
  return accountName
    ? `Mueve dinero de ${accountName} a la tarjeta. No cuenta como gasto.`
    : "Este pago no toca tus cuentas: solo baja el saldo de la tarjeta. Las compras ya son gasto."
}

function PaymentForm({
  debt,
  entry,
  accounts,
  onSaved,
  onCancel
}: PaymentFormProps) {
  const isEditing = entry !== undefined
  const isReceivable = debt.kind === "receivable"
  const isCard = debt.kind === "credit_card"
  const [mode, setMode] = useState<PaymentMode>(
    entry?.kind === "advance" ? "advance" : "payment"
  )
  const isAdvance = mode === "advance"
  const isFee = entry?.kind === "fee"
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
      const noun = isAdvance ? "Avance" : isReceivable ? "Abono" : "Pago"
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

      {isCard && !isEditing && (
        <Tabs
          selectedKey={mode}
          onSelectionChange={(key) => setMode(key as PaymentMode)}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Tipo de movimiento de la tarjeta">
              <Tabs.Tab id="payment">
                Pago
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="advance">
                Avance
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
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
          allowTransfer={!isAdvance && !isReceivable}
          onAccountChange={setAccountId}
        />
      )}

      {!isEditing && isCard && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          {cardEffect(mode, accountName)}
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
