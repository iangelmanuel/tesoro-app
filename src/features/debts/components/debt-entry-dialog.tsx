"use client"

import { useActionState, useEffect, useState } from "react"
import {
  Button,
  Checkbox,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Tabs,
  TextField,
  cn,
  toast
} from "@heroui/react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { CategorySelectField } from "@/components/forms/category-select-field"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { selectableAccounts } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
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
import { amountInput } from "./field"
import { LinkableTransactionsField } from "./linkable-transactions-field"

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
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Editar movimiento</Modal.Heading>
              <p className="text-sm text-muted">
                {data
                  ? `${data.debt.name}. Cambia cualquier dato, también el tipo: se guarda como si lo registraras de nuevo.`
                  : "Cargando el movimiento..."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              {data ? (
                <DebtEntryForm
                  workspaceId={workspaceId}
                  data={data}
                  accounts={accounts}
                  categories={categories}
                  currency={currency}
                  onSaved={() => onOpenChange(false)}
                  onCancel={() => onOpenChange(false)}
                />
              ) : loadError ? (
                <p
                  role="alert"
                  className="text-sm text-danger"
                >
                  {loadError}
                </p>
              ) : (
                <div
                  role="status"
                  aria-label="Cargando el movimiento"
                  className="flex flex-col gap-4"
                >
                  <Skeleton className="h-11 rounded-full" />
                  <Skeleton className="h-11 rounded-full" />
                  <Skeleton className="h-11 rounded-full" />
                </div>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
        <Select
          fullWidth
          value={type}
          onChange={(key) => {
            if (key == null) return
            setType(key as EntryType)
            setLinkId("")
          }}
          isInvalid={Boolean(errors?.type)}
          className="flex flex-col gap-2"
        >
          <Label>Tipo</Label>
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
      ) : null}
      <input
        type="hidden"
        name="type"
        value={type}
      />

      {type === "adjustment" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">El ajuste</p>
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

      {(type === "purchase" || type === "advance") && (
        <TextField
          name="installments"
          inputMode="numeric"
          autoComplete="off"
          maxLength={2}
          value={installments}
          onChange={setInstallments}
          isInvalid={Boolean(errors?.installments)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Cuotas (opcional)</Label>
          <Input placeholder={`1 a ${MAX_INSTALLMENTS}`} />
          <Description>
            Cada cuota suma al pago del mes de la tarjeta.
          </Description>
          <FieldError>{errors?.installments?.[0]}</FieldError>
        </TextField>
      )}

      {canCreateTransaction && (
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

      {showLink && validAmount && (
        <LinkableTransactionsField
          entryId={entry.id}
          type={type}
          amount={amount}
          occurredOn={occurredOn}
          currency={currency}
          noun={transactionType === "income" ? "ingreso" : "gasto"}
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
          value={accountId}
          onChange={setAccountId}
          accounts={selectableAccounts(accounts, entry.payment_account_id)}
          allowNone={!accountRequired}
          error={errors?.account_id?.[0]}
        />
      )}

      {showMovementFields && (
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
            <Label>Descripción (opcional)</Label>
            <Input
              placeholder={`${
                type === "advance"
                  ? "Avance"
                  : isReceivable || type === "extra"
                    ? "Abono"
                    : "Pago"
              } ${debt.name}`}
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

      <div className="flex flex-col gap-1 rounded-lg bg-default p-3 text-sm text-muted">
        {newBalance !== null && (
          <p className="tabular-nums">
            Saldo de la deuda:{" "}
            {newBalance === debt.balance ? (
              <>no cambia ({formatCurrency(debt.balance, currency)})</>
            ) : (
              <>
                {formatCurrency(debt.balance, currency)} →{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(newBalance, currency)}
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
          className={cn("rounded-lg p-3 text-sm", TONE_BADGE_CLASSES.warning)}
        >
          Para guardar como {entryTypeInfo(type, debt.kind).label.toLowerCase()}
          , completa {missing.join(" y ")}.
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
          return `El gasto elegido se elimina: el pago a la tarjeta ya descuenta de la cuenta.${extra}`
        }
        return accountName
          ? `Sale de ${accountName} hacia la tarjeta. No cuenta como gasto.${extra}`
          : `No toca tus cuentas: solo baja el saldo.${extra}`
      }
      if (!createsTransaction) {
        return `No queda como ${isReceivable ? "ingreso" : "gasto"} en Movimientos.${extra}`
      }
      if (linking) {
        return `Se enlaza al ${isReceivable ? "ingreso" : "gasto"} elegido: no se crea otro.${extra}`
      }
      return accountName
        ? `${isReceivable ? "Entra a" : "Sale de"} ${accountName} como ${isReceivable ? "ingreso" : "gasto"}.${extra}`
        : "Elige la cuenta."
    }
    case "purchase":
      return "Una compra no toca tus cuentas: solo sube el saldo de la tarjeta."
    case "advance":
      if (linking) return "Se enlaza al ingreso elegido: no se crea otro."
      return accountName
        ? `Entra a ${accountName} como ingreso (Avance de tarjeta).`
        : "Elige la cuenta a la que entró el dinero."
    case "fee":
      return "La cuota de manejo no toca tus cuentas: la pagas con la tarjeta."
    case "adjustment":
      return "Un ajuste no toca tus cuentas."
  }
}
