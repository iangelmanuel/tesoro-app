"use client"

import { useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import {
  accountEffect,
  entryCategoryPlaceholder,
  entryDescriptionPlaceholder
} from "../debt-entry-form-values"
import type { DebtEntryEditorData } from "../entry-actions"
import {
  DIRECTION_OPTIONS,
  entryTypeInfo,
  entryTypeOptions
} from "../entry-types"
import { MAX_INSTALLMENTS } from "../installments"
import { CreateTransactionCheckbox } from "./create-transaction-checkbox"
import { LinkableTransactionsField } from "./linkable-transactions-field"
import { useDebtEntryDialog } from "./use-debt-entry-dialog"

interface DebtEntryDialogFormProps {
  workspaceId: string
  data: DebtEntryEditorData
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * Formulario del editor de un movimiento de deuda: el tipo se puede cambiar y
 * se guarda como si se registrara de nuevo (SPEC 42, parte 3)
 */
export function DebtEntryDialogForm({
  workspaceId,
  data: { entry, debt },
  accounts,
  categories,
  currency,
  onSaved,
  onCancel
}: DebtEntryDialogFormProps) {
  const {
    types,
    state,
    formAction,
    pending,
    type,
    changeType,
    amountText,
    setAmountText,
    direction,
    setDirection,
    occurredOn,
    setOccurredOn,
    time,
    setTime,
    note,
    setNote,
    accountId,
    setAccountId,
    createTransaction,
    setCreateTransaction,
    description,
    setDescription,
    linkId,
    adopt,
    flags,
    amount,
    validAmount,
    newBalance,
    accountName,
    missing
  } = useDebtEntryDialog({ entry, debt, accounts, onSaved })
  const {
    isCard,
    isReceivable,
    isPayment,
    canCreateTransaction,
    createsTransaction,
    showAccount,
    accountRequired,
    transactionType,
    showLink
  } = flags
  const [categoryId, setCategoryId] = useState(entry.category_id ?? "")
  const [installments, setInstallments] = useState(
    entry.installments ? String(entry.installments) : ""
  )
  const errors = state.fieldErrors
  const categoryOptions = categories.filter(
    (category) =>
      category.type === transactionType &&
      (category.archived_at === null || category.id === entry.category_id)
  )

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

      {types.length > 1 ? (
        <SelectField
          label="Tipo"
          help="debtEntry.type"
          value={type}
          onChange={changeType}
          options={entryTypeOptions(types, debt.kind)}
          error={errors?.type?.[0]}
        />
      ) : null}
      <input
        type="hidden"
        name="type"
        value={type}
      />

      {type === "adjustment" && (
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
        value={amountText}
        onChange={(event) => setAmountText(event.target.value)}
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

      {(type === "purchase" || type === "advance") && (
        <TextInputField
          name="installments"
          label="Cuotas (opcional)"
          help="debtEntry.installments"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          placeholder={`1 a ${MAX_INSTALLMENTS}`}
          value={installments}
          onChange={(event) => setInstallments(event.target.value)}
          description="Cada cuota suma al pago del mes de la tarjeta."
          error={errors?.installments?.[0]}
        />
      )}

      {canCreateTransaction && (
        <CreateTransactionCheckbox
          checked={createTransaction}
          onCheckedChange={setCreateTransaction}
          income={isReceivable}
        />
      )}

      {showLink && validAmount && (
        <LinkableTransactionsField
          entryId={entry.id}
          type={type}
          amount={amount}
          occurredOn={occurredOn}
          currency={currency}
          noun={transactionType === "income" ? "entrada" : "salida"}
          noneLabel={
            isCard && isPayment
              ? "No, es un pago aparte"
              : "No, crear uno nuevo"
          }
          value={linkId}
          onChange={adopt}
          error={errors?.link_transaction_id?.[0]}
        />
      )}

      {showAccount && (
        <AccountSelectField
          workspaceId={workspaceId}
          name="account_id"
          label={
            type === "advance" || isReceivable
              ? "Cuenta que recibe"
              : "Cuenta que paga"
          }
          help="common.account"
          value={accountId}
          onChange={setAccountId}
          accounts={selectableAccounts(accounts, entry.payment_account_id)}
          allowNone={!accountRequired}
          error={errors?.account_id?.[0]}
        />
      )}

      {accountRequired && (
        <>
          <TextInputField
            name="description"
            label="Descripción (opcional)"
            help="common.description"
            maxLength={120}
            placeholder={entryDescriptionPlaceholder(
              type,
              isReceivable,
              debt.name
            )}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            error={errors?.description?.[0]}
          />

          <CategorySelectField
            name="category_id"
            value={categoryId}
            onChange={setCategoryId}
            categories={categoryOptions}
            workspaceId={workspaceId}
            type={transactionType}
            help="common.category"
            placeholder={entryCategoryPlaceholder(type, isReceivable)}
            error={errors?.category_id?.[0]}
          />
        </>
      )}

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder="Cuota de noviembre"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={errors?.note?.[0]}
      />

      <div className="flex flex-col gap-1 rounded-2xl bg-subtle p-3 text-sm text-muted-foreground">
        {newBalance !== null && (
          <p className="tabular-nums">
            Saldo de la deuda:{" "}
            {newBalance === debt.balance ? (
              <>
                no cambia (
                <Amount
                  value={debt.balance}
                  currency={currency}
                />
                )
              </>
            ) : (
              <>
                <Amount
                  value={debt.balance}
                  currency={currency}
                />{" "}
                →{" "}
                <span className="font-medium text-foreground">
                  <Amount
                    value={newBalance}
                    currency={currency}
                  />
                </span>
              </>
            )}
          </p>
        )}
        <p>
          {accountEffect({
            type,
            isCard,
            isReceivable,
            createsTransaction,
            accountName,
            linking: linkId !== ""
          })}
          {entry.transaction_id !== null &&
            !createsTransaction &&
            !(type === "advance" && accountId) &&
            " Su movimiento en Movimientos se elimina."}
        </p>
      </div>

      {missing.length > 0 && (
        <p
          role="status"
          className={cn("rounded-2xl p-3 text-sm", TONE_BADGE_CLASSES.warning)}
        >
          Para guardar como {entryTypeInfo(type, debt.kind).label.toLowerCase()}
          , completa {missing.join(" y ")}.
        </p>
      )}

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
          {pending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  )
}
