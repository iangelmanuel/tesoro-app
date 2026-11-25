"use client"

import { useState } from "react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import {
  type AdjustmentDirection,
  DIRECTION_OPTIONS,
  entryTypeOptions,
  usesPaymentAccount
} from "../entry-types"
import { MAX_INSTALLMENTS } from "../installments"
import {
  EXTRA_EFFECT,
  type PaymentDebt,
  type PaymentInitialValues,
  cardEffect,
  notePlaceholder
} from "../payment-form-values"
import { CreateTransactionCheckbox } from "./create-transaction-checkbox"
import { usePaymentDialog } from "./use-payment-dialog"

interface PaymentDialogFormProps {
  workspaceId: string
  debt: PaymentDebt
  accounts: PaymentAccountOption[]
  initialValues?: PaymentInitialValues
  onSaved: () => void
  onCancel: () => void
}

/**
 * Formulario de un movimiento nuevo de una deuda: tipo, monto, fecha, cuotas,
 * nota, movimiento y cuenta según el tipo (SPEC 41, 46 y 49)
 */
export function PaymentDialogForm({
  workspaceId,
  debt,
  accounts,
  initialValues,
  onSaved,
  onCancel
}: PaymentDialogFormProps) {
  const isReceivable = debt.kind === "receivable"
  const isCard = debt.kind === "credit_card"
  const {
    modes: types,
    mode,
    changeMode,
    state,
    formAction,
    pending,
    amount,
    note,
    description,
    createTransaction,
    setCreateTransaction,
    accountId,
    setAccountId,
    defaultAccountId
  } = usePaymentDialog({ debt, accounts, initialValues, onSaved })
  const isPayment = mode === "payment" || mode === "extra"
  const isCharge = mode === "purchase" || mode === "advance"
  const isExtra = mode === "extra"
  const [occurredOn, setOccurredOn] = useState(() => todayISO())
  const [time, setTime] = useState("")
  const [direction, setDirection] = useState<AdjustmentDirection>("up")
  const errors = state.fieldErrors
  const values = state.values
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null
  const showAccount = usesPaymentAccount(mode, isCard, createTransaction)

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
        <SelectField
          label="Tipo"
          help="debtEntry.type"
          value={mode}
          onChange={changeMode}
          options={entryTypeOptions(types, debt.kind)}
          error={errors?.type?.[0]}
        />
      )}

      {isPayment && !isReceivable && (
        <input
          type="hidden"
          name="is_extra_payment"
          value={isExtra ? "true" : "false"}
        />
      )}

      {mode === "adjustment" && (
        <SegmentedField
          name="direction"
          label="El ajuste"
          help="debtEntry.direction"
          value={direction}
          onChange={setDirection}
          options={DIRECTION_OPTIONS}
        />
      )}

      <TextInputField
        name="amount"
        label="Monto"
        help="common.amount"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={amount.value}
        onChange={(event) => amount.setValue(event.target.value)}
        isRequired
        error={errors?.amount?.[0]}
      />

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
        <TextInputField
          name="installments"
          label="Cuotas (opcional)"
          help="debtEntry.installments"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          placeholder={`1 a ${MAX_INSTALLMENTS}`}
          defaultValue={
            values?.installments ??
            (initialValues?.installments
              ? String(initialValues.installments)
              : "")
          }
          error={errors?.installments?.[0]}
        />
      )}

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder={notePlaceholder(mode, isReceivable)}
        value={note.value}
        onChange={(event) => note.setValue(event.target.value)}
        error={errors?.note?.[0]}
      />

      {!isCard && isPayment && (
        <CreateTransactionCheckbox
          checked={createTransaction}
          onCheckedChange={setCreateTransaction}
          income={isReceivable}
        />
      )}

      {/* Solo con movimiento: una tarjeta no crea uno */}
      {!isCard && isPayment && createTransaction && (
        <TextInputField
          name="description"
          label="Descripción"
          help="common.description"
          maxLength={120}
          placeholder={isReceivable ? "Cobro" : "Pago de la cuota"}
          value={description.value}
          onChange={(event) => description.setValue(event.target.value)}
          error={errors?.description?.[0]}
        />
      )}

      {/* En préstamos y cuentas por cobrar la cuenta es la del movimiento: sin
          él no aplica. El avance no lleva traspaso y un abono es un ingreso */}
      {showAccount && (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={parsePaymentAmount(amount.value)}
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
          defaultAccountId={defaultAccountId}
          onAccountChange={setAccountId}
        />
      )}

      {mode === "payment" && !isReceivable && debt.cycleCovered && (
        <p
          role="status"
          className={cn("rounded-2xl p-3 text-sm", TONE_BADGE_CLASSES.warning)}
        >
          La cuota de este ciclo ya está cubierta. Puedes registrar el pago
          igual o cambiar el tipo a Abono.
        </p>
      )}

      {isCard ? (
        <p className="rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
          {cardEffect(mode, accountName)}
        </p>
      ) : isExtra ? (
        <p className="rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
          Baja el saldo de la deuda. {EXTRA_EFFECT}
        </p>
      ) : mode === "adjustment" ? (
        <p className="rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
          Corrige el saldo de la deuda. No toca tus cuentas ni crea movimiento.
        </p>
      ) : null}

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
          {pending ? "Guardando..." : "Registrar"}
        </Button>
      </div>
    </form>
  )
}
