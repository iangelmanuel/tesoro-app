"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  toast
} from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { todayISO } from "@/libs/dates"
import { convertAdjustment } from "../actions"
import type { Debt, DebtEntry, LinkableTransaction } from "../queries"
import type { PaymentFormState } from "../types"
import { LinkableTransactionsField } from "./linkable-transactions-field"

interface ConvertAdjustmentFormProps {
  debt: Pick<Debt, "kind" | "name">
  /** Ajuste que bajó el saldo */
  entry: Pick<
    DebtEntry,
    "id" | "amount" | "occurred_on" | "occurred_time" | "note"
  >
  workspaceId: string
  /** Cuentas activas con saldo */
  accounts: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento nuevo o enlazado */
  categories: Category[]
  currency: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * "Fue un pago" / "Fue un cobro" (SPEC 42): convierte un ajuste que bajó el
 * saldo en un pago que sale de una cuenta (o un cobro que entra a ella). Se
 * enlaza a un movimiento ya registrado o se crea uno nuevo. El monto es el
 * del ajuste y el saldo de la deuda no cambia.
 */
export function ConvertAdjustmentForm({
  debt,
  entry,
  workspaceId,
  accounts,
  categories,
  currency,
  onSaved,
  onCancel
}: ConvertAdjustmentFormProps) {
  const isCard = debt.kind === "credit_card"
  const isReceivable = debt.kind === "receivable"
  const amount = -entry.amount
  const transactionType: Category["type"] = isReceivable ? "income" : "expense"

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await convertAdjustment(prevState, formData)
    if (result.ok) {
      toast.success(isReceivable ? "Cobro registrado" : "Pago registrado")
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [linkId, setLinkId] = useState(() => values?.link_transaction_id ?? "")
  const [occurredOn, setOccurredOn] = useState(
    () => values?.occurred_on ?? entry.occurred_on
  )
  const [time, setTime] = useState(
    () => values?.occurred_time ?? entry.occurred_time?.slice(0, 5) ?? ""
  )
  const [accountId, setAccountId] = useState(() => values?.account_id ?? "")
  const [description, setDescription] = useState(
    () =>
      values?.description ?? `${isReceivable ? "Abono" : "Pago"} ${debt.name}`
  )
  const [note, setNote] = useState(() => values?.note ?? entry.note ?? "")
  const [categoryId, setCategoryId] = useState(() => values?.category_id ?? "")

  // Elegir un movimiento ya registrado adopta su cuenta, fecha y
  // descripción. En una tarjeta el gasto se borra: su descripción pasa a la
  // nota para no perderla
  function adopt(candidate: LinkableTransaction | null) {
    setLinkId(candidate?.id ?? "")
    if (!candidate) return
    setAccountId(candidate.account_id ?? "")
    setOccurredOn(candidate.occurred_on)
    setTime(candidate.occurred_time?.slice(0, 5) ?? "")
    if (isCard) {
      setNote(candidate.note ?? candidate.description)
    } else {
      setDescription(candidate.description)
      if (candidate.note) setNote(candidate.note)
    }
  }

  const categoryOptions = categories.filter(
    (category) =>
      category.type === transactionType && category.archived_at === null
  )
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null
  const noun = isReceivable ? "ingreso" : "gasto"

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="id"
        value={entry.id}
      />

      <div className="flex items-center justify-between gap-3 rounded-lg bg-default p-3 text-sm">
        <span className="text-muted">
          Monto {isReceivable ? "del cobro" : "del pago"}
        </span>
        <Amount
          value={amount}
          currency={currency}
          className="font-medium"
        />
      </div>

      <LinkableTransactionsField
        entryId={entry.id}
        currency={currency}
        noun={noun}
        value={linkId}
        onChange={adopt}
        error={errors?.link_transaction_id?.[0]}
      />

      {isCard && linkId && (
        <p className="rounded-lg bg-default p-3 text-sm text-muted">
          Ese gasto se elimina de Movimientos: el pago de la tarjeta ya
          descuenta de la cuenta y dejarlo contaría la salida dos veces. Su
          descripción queda en la nota.
        </p>
      )}

      <AccountSelectField
        workspaceId={workspaceId}
        name="account_id"
        label={isReceivable ? "Cuenta que recibe" : "Cuenta que paga"}
        value={accountId}
        onChange={setAccountId}
        accounts={selectableAccounts(accounts, accountId)}
        error={errors?.account_id?.[0]}
      />

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

      {/* Una tarjeta no crea movimiento: sin descripción ni categoría */}
      {!isCard && (
        <>
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
            <Input
              placeholder={`${isReceivable ? "Abono" : "Pago"} ${debt.name}`}
            />
            <FieldError>{errors?.description?.[0]}</FieldError>
          </TextField>

          <CategorySelectField
            name="category_id"
            value={categoryId}
            onChange={setCategoryId}
            categories={categoryOptions}
            workspaceId={workspaceId}
            type={transactionType}
            placeholder={
              linkId
                ? "La del movimiento elegido"
                : isReceivable
                  ? "Cobros"
                  : "Deudas"
            }
            error={errors?.category_id?.[0]}
          />
        </>
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
        <Label>Nota (opcional)</Label>
        <Input placeholder="Cuota de noviembre" />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

      <p className="rounded-lg bg-default p-3 text-sm text-muted">
        El saldo de la deuda no cambia: el ajuste ya lo había bajado.{" "}
        {accountName
          ? isReceivable
            ? `${accountName} sube por este cobro.`
            : `${accountName} baja por este pago.`
          : `Elige la cuenta ${isReceivable ? "a la que entró" : "de la que salió"} el dinero.`}
      </p>

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
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
