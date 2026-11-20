"use client"

import { useActionState, useId, useState } from "react"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp, FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { activeAccountId } from "@/features/accounts/active-account"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { cn } from "@/libs/cn"
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

type PaymentDebt = Pick<Debt, "id" | "kind"> & {
  /** Cuenta por defecto (SPEC 41): se prellena al registrar si sigue activa */
  account_id?: string | null
  /** Descripción prellenada del movimiento (SPEC 41); sin ella, vacía */
  descriptions?: DebtPaymentDescriptions
  /**
   * La cuota del ciclo actual ya está cubierta (`nextPayment(debt).status ===
   * "paid"`): un Pago nuevo muestra un aviso, sin bloquear (SPEC 49)
   */
  cycleCovered?: boolean
}

/**
 * Tipo del movimiento nuevo (SPEC 46): los mismos del editor (SPEC 42).
 * Pago y Abono van por recordPayment, Compra y Avance por recordAdvance, y
 * Cuota de manejo y Ajuste por recordDebtCharge
 */
export type PaymentMode = EntryType

/**
 * Prellenado de un movimiento nuevo de la deuda (Duplicar, SPEC 49). Sin fecha
 * ni hora: ocurre hoy. Una cuenta archivada llega como null. La categoría no
 * se copia: crear asigna la de siempre
 */
export interface PaymentInitialValues {
  /** Nunca "adjustment": los ajustes no se duplican */
  mode: Exclude<PaymentMode, "adjustment">
  amount: number
  account_id: string | null
  /** Descripción del movimiento enlazado; vacía si el original no tenía */
  description: string
  note: string
  /** Cuotas de una compra o avance */
  installments?: number | null
}

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
  /** Prellenado del movimiento nuevo; solo con `debt` fija */
  initialValues?: PaymentInitialValues
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
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
  initialValues,
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  // Sin deuda fija arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(
    () => debts?.[0]?.id ?? ""
  )
  const debt: PaymentDebt | undefined =
    fixedDebt ?? debts?.find((option) => option.id === selectedDebtId)
  const kind = debt?.kind ?? "loan"

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={kind === "receivable" ? "Registrar abono" : "Registrar movimiento"}
      description={
        kind === "receivable"
          ? "Lo que te pagaron de esta cuenta por cobrar."
          : "Un pago, abono, compra, cargo o ajuste de esta deuda."
      }
    >
      {(close) => (
        <div className="flex flex-col gap-4">
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
              initialValues={fixedDebt ? initialValues : undefined}
              onSaved={close}
              onCancel={close}
            />
          )}
        </div>
      )}
    </FormDialog>
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
 * Elegir deuda + formulario de pago, sin el diálogo: tab "Pago de deuda" del
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
    <div className="flex flex-col gap-4">
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
    <SelectField
      label="Deuda"
      help="debtEntry.debt"
      value={value}
      onChange={onChange}
      options={debts.map((option) => ({
        value: option.id,
        label: option.name
      }))}
    />
  )
}

interface PaymentFormProps {
  workspaceId: string
  debt: PaymentDebt
  accounts: PaymentAccountOption[]
  initialValues?: PaymentInitialValues
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
  initialValues,
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
  // Un duplicado arranca con el tipo del original si la deuda lo admite
  const initialMode: PaymentMode =
    initialValues && types.includes(initialValues.mode)
      ? initialValues.mode
      : "payment"
  const [mode, setMode] = useState<PaymentMode>(initialMode)
  const isPayment = mode === "payment" || mode === "extra"
  const isCharge = mode === "purchase" || mode === "advance"
  const isExtra = mode === "extra"
  const [occurredOn, setOccurredOn] = useState(() => todayISO())
  const [time, setTime] = useState("")
  const [direction, setDirection] = useState<AdjustmentDirection>("up")
  const directionLabelId = useId()
  const createTransactionId = useId()

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
    () =>
      values?.amount ??
      (initialValues ? amountInput(initialValues.amount) : amountFor("payment"))
  )
  const [prefilledAmount, setPrefilledAmount] = useState(amountText)
  // Un duplicado lleva movimiento si el original lo tenía (con descripción)
  const [createTransaction, setCreateTransaction] = useState(() =>
    values
      ? values.create_transaction === "on"
      : !initialValues || initialValues.description !== ""
  )
  // Cuenta por defecto de la deuda, si sigue activa (SPEC 41)
  const defaultAccountId = activeAccountId(accounts, debt.account_id) ?? ""
  // La del duplicado manda mientras no se cambie entre avance y pago
  const accountFor = (next: PaymentMode) =>
    initialValues && (next === "advance") === (initialMode === "advance")
      ? (initialValues.account_id ?? "")
      : next === "advance"
        ? ""
        : defaultAccountId
  const [accountId, setAccountId] = useState(() => accountFor(initialMode))
  // Descripción del movimiento (SPEC 41): se prellena según Pago o Abono y
  // se respeta lo que el usuario escriba
  const descriptionFor = (next: PaymentMode) =>
    debt.descriptions?.[next === "extra" ? "extra" : "payment"]
  const [description, setDescription] = useState(
    () =>
      values?.description ??
      initialValues?.description ??
      descriptionFor("payment") ??
      ""
  )
  const [prefilledDescription, setPrefilledDescription] = useState(description)
  // Nota del movimiento en el historial de la deuda: en Pago y Abono, el
  // mismo texto que la descripción ("Pago {nombre} · {mes}"); en una tarjeta
  // es el único texto del pago. Los demás tipos arrancan vacíos
  const noteFor = (next: PaymentMode) =>
    next === "payment" || next === "extra" ? (descriptionFor(next) ?? "") : ""
  const [note, setNote] = useState(
    () => values?.note ?? initialValues?.note ?? noteFor("payment")
  )
  const [prefilledNote, setPrefilledNote] = useState(note)
  function changeMode(next: PaymentMode) {
    setMode(next)
    // El avance arranca sin cuenta: la cuenta por defecto es la que paga la
    // tarjeta, no la que recibe un avance
    if ((next === "advance") !== (mode === "advance")) {
      setAccountId(accountFor(next))
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
        <SelectField
          label="Tipo"
          help="debtEntry.type"
          value={mode}
          onChange={changeMode}
          options={types.map((option) => {
            const info = entryTypeInfo(option, debt.kind)
            return { value: option, label: info.label, description: info.hint }
          })}
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
        <div className="flex flex-col gap-2">
          <FieldLabel
            id={directionLabelId}
            help="debtEntry.direction"
          >
            El ajuste
          </FieldLabel>
          <ToggleGroup
            value={[direction]}
            onValueChange={(next) => {
              const [value] = next
              if (value) setDirection(value as AdjustmentDirection)
            }}
            aria-labelledby={directionLabelId}
            spacing={1}
            className="h-12 w-full rounded-4xl bg-subtle p-0.5 dark:bg-card"
          >
            {(
              [
                ["up", "Sube"],
                ["down", "Baja"]
              ] as const
            ).map(([value, label]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="h-full flex-1 px-3 data-pressed:bg-card data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-(--surface-shadow) dark:data-pressed:bg-highlight"
              >
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <input
            type="hidden"
            name="direction"
            value={direction}
          />
        </div>
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
        value={note}
        onChange={(event) => setNote(event.target.value)}
        error={errors?.note?.[0]}
      />

      {!isCard && isPayment && (
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

      {/* Solo con movimiento: una tarjeta no crea uno */}
      {!isCard && isPayment && createTransaction && (
        <TextInputField
          name="description"
          label="Descripción"
          help="common.description"
          maxLength={120}
          placeholder={isReceivable ? "Cobro" : "Pago de la cuota"}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors?.description?.[0]}
        />
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
          defaultAccountId={accountFor(mode)}
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
