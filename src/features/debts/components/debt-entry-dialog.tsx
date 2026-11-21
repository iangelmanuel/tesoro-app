"use client"

import { useActionState, useEffect, useId, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { amountInput } from "@/components/forms/amount-format"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/sonner"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { parseAmount } from "@/features/transactions/schemas"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import {
  type EntryEditorDebt,
  loadDebtEntryEditor,
  updateDebtEntry
} from "../actions"
import {
  type AdjustmentDirection,
  type EntryType,
  balanceEffect,
  entryKindOf,
  entryTypeInfo,
  entryTypeOf,
  entryTypesFor
} from "../entry-types"
import { MAX_INSTALLMENTS } from "../installments"
import type { DebtEntry, LinkableTransaction } from "../queries"
import type { PaymentFormState } from "../types"
import { LinkableTransactionsField } from "./linkable-transactions-field"

const DIRECTION_OPTIONS = [
  { value: "up", label: "Sube" },
  { value: "down", label: "Baja" }
] as const satisfies readonly { value: AdjustmentDirection; label: string }[]

/** Movimiento y deuda que edita el diálogo */
export interface DebtEntryEditorData {
  entry: DebtEntry
  debt: EntryEditorDebt
}

interface DebtEntryDialogProps {
  workspaceId: string
  entryId: string
  /** Datos ya cargados (Sheet de la deuda). Sin ellos se piden al abrir */
  initial?: DebtEntryEditorData
  /** Cuentas activas con saldo */
  accounts: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento enlazado */
  categories: Category[]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Editar cualquier movimiento de una deuda (SPEC 42, parte 3): pago, abono,
 * compra, avance, cuota de manejo o ajuste. El tipo se puede cambiar y se
 * guarda como si se registrara de nuevo; los campos que pide el tipo nuevo
 * se marcan si faltan. Lo usan el Sheet de la deuda y Movimientos.
 */
export function DebtEntryDialog({
  workspaceId,
  entryId,
  initial,
  accounts,
  categories,
  currency,
  open,
  onOpenChange
}: DebtEntryDialogProps) {
  const [loaded, setLoaded] = useState<DebtEntryEditorData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const data = initial ?? loaded

  // Movimientos no trae el abono completo: se pide al abrir
  useEffect(() => {
    if (!open || initial) return
    let active = true
    loadDebtEntryEditor(entryId).then((result) => {
      if (!active) return
      if ("error" in result) {
        setLoadError(result.error)
      } else {
        setLoadError(null)
        setLoaded(result)
      }
    })
    return () => {
      active = false
    }
  }, [open, initial, entryId])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title="Editar movimiento"
      description={
        data
          ? `${data.debt.name}. Cambia cualquier dato, también el tipo: se guarda como si lo registraras de nuevo.`
          : "Cargando el movimiento..."
      }
    >
      {(close) =>
        data ? (
          <DebtEntryForm
            workspaceId={workspaceId}
            data={data}
            accounts={accounts}
            categories={categories}
            currency={currency}
            onSaved={close}
            onCancel={close}
          />
        ) : loadError ? (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {loadError}
          </p>
        ) : (
          <div
            role="status"
            aria-label="Cargando el movimiento"
            className="flex flex-col gap-4"
          >
            <Skeleton className="h-11 rounded-4xl" />
            <Skeleton className="h-11 rounded-4xl" />
            <Skeleton className="h-11 rounded-4xl" />
          </div>
        )
      }
    </FormDialog>
  )
}

interface DebtEntryFormProps {
  workspaceId: string
  data: DebtEntryEditorData
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
  onSaved: () => void
  onCancel: () => void
}

function DebtEntryForm({
  workspaceId,
  data: { entry, debt },
  accounts,
  categories,
  currency,
  onSaved,
  onCancel
}: DebtEntryFormProps) {
  const isCard = debt.kind === "credit_card"
  const isReceivable = debt.kind === "receivable"
  const originalType = entryTypeOf(entry)
  const types = entryTypesFor(debt, originalType)

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await updateDebtEntry(prevState, formData)
    if (result.ok) {
      toast.success("Movimiento actualizado")
      onSaved()
    }
    return result
  }, {})
  const errors = state.fieldErrors

  const [type, setType] = useState<EntryType>(originalType)
  const [amountText, setAmountText] = useState(() =>
    amountInput(Math.abs(entry.amount))
  )
  const [direction, setDirection] = useState<AdjustmentDirection>(() =>
    entry.kind === "adjustment" && entry.amount < 0 ? "down" : "up"
  )
  const [occurredOn, setOccurredOn] = useState(entry.occurred_on)
  const [time, setTime] = useState(() => entry.occurred_time?.slice(0, 5) ?? "")
  const [note, setNote] = useState(entry.note ?? "")
  const [accountId, setAccountId] = useState(entry.payment_account_id ?? "")
  // Un pago de préstamo o Me deben guardado sin movimiento lo conserva así;
  // un movimiento que pasa a pago arranca registrándolo
  const [createTransaction, setCreateTransaction] = useState(
    () => entry.kind !== "payment" || entry.transaction_id !== null
  )
  const [description, setDescription] = useState(entry.description ?? "")
  const [categoryId, setCategoryId] = useState(entry.category_id ?? "")
  const [installments, setInstallments] = useState(
    entry.installments ? String(entry.installments) : ""
  )
  const [linkId, setLinkId] = useState("")
  const createTransactionId = useId()

  const kind = entryKindOf(type)
  const isPayment = kind === "payment"
  // Préstamo y Me deben: el pago puede registrar su gasto o ingreso
  const canCreateTransaction = isPayment && !isCard
  const createsTransaction = canCreateTransaction && createTransaction
  const showAccount =
    (isPayment && (isCard || createsTransaction)) || type === "advance"
  const accountRequired = createsTransaction || type === "advance"
  const showMovementFields = createsTransaction || type === "advance"
  const transactionType: Category["type"] =
    type === "advance" || isReceivable ? "income" : "expense"
  // Ya lo registraste: un gasto o ingreso suelto que puede ser este. No
  // aplica al pago de tarjeta que ya era pago
  const canLink =
    (isPayment && (isCard || createsTransaction)) || type === "advance"
  const showLink =
    canLink &&
    (entry.transaction_id === null || kind !== entry.kind) &&
    !(isCard && isPayment && entry.kind === "payment")

  const amount = parseAmount(amountText)
  const validAmount = !Number.isNaN(amount) && amount > 0
  const signedAmount =
    type === "adjustment" && direction === "down" ? -amount : amount
  const newBalance = validAmount
    ? Math.round(
        (debt.balance -
          balanceEffect(entry.kind, entry.amount) +
          balanceEffect(kind, signedAmount)) *
          100
      ) / 100
    : null
  const accountName =
    accounts.find((account) => account.id === accountId)?.name ?? null

  // Lo que el tipo nuevo pide y aún falta
  const missing = [
    !validAmount && "el monto",
    accountRequired && !accountId && !linkId && "la cuenta"
  ].filter(Boolean) as string[]

  function adopt(candidate: LinkableTransaction | null) {
    setLinkId(candidate?.id ?? "")
    if (!candidate) return
    setAccountId(candidate.account_id ?? "")
    setOccurredOn(candidate.occurred_on)
    setTime(candidate.occurred_time?.slice(0, 5) ?? "")
    if (isCard && isPayment) {
      // El gasto se borra: su descripción pasa a la nota
      setNote(candidate.note ?? candidate.description)
    } else {
      setDescription(candidate.description)
      if (candidate.note) setNote(candidate.note)
    }
  }

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
          onChange={(next) => {
            setType(next)
            setLinkId("")
          }}
          options={types.map((option) => {
            const info = entryTypeInfo(option, debt.kind)
            return { value: option, label: info.label, description: info.hint }
          })}
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
        <div className="flex min-h-11 items-center gap-0.5">
          <Checkbox
            id={createTransactionId}
            name="create_transaction"
            value="on"
            checked={createTransaction}
            onCheckedChange={setCreateTransaction}
          />
          <Label
            htmlFor={createTransactionId}
            className="min-h-11 pl-3 font-normal"
          >
            {isReceivable ? "Registrar como entrada" : "Registrar como salida"}
          </Label>
          <FieldHelp
            help="debtEntry.createTransaction"
            label="Registrar el movimiento"
          />
        </div>
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

      {showMovementFields && (
        <>
          <TextInputField
            name="description"
            label="Descripción (opcional)"
            help="common.description"
            maxLength={120}
            placeholder={`${
              type === "advance"
                ? "Avance"
                : isReceivable || type === "extra"
                  ? "Abono"
                  : "Pago"
            } ${debt.name}`}
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
            placeholder={
              type === "advance"
                ? "Avance de tarjeta"
                : isReceivable
                  ? "Cobros"
                  : "Deudas"
            }
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

/** Qué pasa con tus cuentas al guardar, según el tipo y la cuenta */
function accountEffect({
  type,
  isCard,
  isReceivable,
  createsTransaction,
  accountName,
  linking
}: {
  type: EntryType
  isCard: boolean
  isReceivable: boolean
  createsTransaction: boolean
  accountName: string | null
  linking: boolean
}) {
  switch (type) {
    case "payment":
    case "extra": {
      const extra = type === "extra" ? " No cubre el pago del mes." : ""
      if (isCard) {
        if (linking) {
          return `La salida elegida se elimina: el pago a la tarjeta ya descuenta de la cuenta.${extra}`
        }
        return accountName
          ? `Sale de ${accountName} hacia la tarjeta. No cuenta como salida.${extra}`
          : `No toca tus cuentas: solo baja el saldo.${extra}`
      }
      if (!createsTransaction) {
        return `No queda como ${isReceivable ? "entrada" : "salida"} en Movimientos.${extra}`
      }
      if (linking) {
        return `Se enlaza a la ${isReceivable ? "entrada" : "salida"} elegida: no se crea otra.${extra}`
      }
      return accountName
        ? `${isReceivable ? "Entra a" : "Sale de"} ${accountName} como ${isReceivable ? "entrada" : "salida"}.${extra}`
        : "Elige la cuenta."
    }
    case "purchase":
      return "Una compra no toca tus cuentas: solo sube el saldo de la tarjeta."
    case "advance":
      if (linking) return "Se enlaza a la entrada elegida: no se crea otra."
      return accountName
        ? `Entra a ${accountName} como entrada (Avance de tarjeta).`
        : "Elige la cuenta a la que entró el dinero."
    case "fee":
      return "La cuota de manejo no toca tus cuentas: la pagas con la tarjeta."
    case "adjustment":
      return "Un ajuste no toca tus cuentas."
  }
}
