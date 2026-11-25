"use client"

import { useActionState, useId, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { useHideAmounts } from "@/components/dashboard/hide-amounts/hide-amounts-context"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { activeAccountId } from "@/features/accounts/active-account"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { AMOUNT_MASK, formatCurrency, formatMonthTitle } from "@/libs/format"
import {
  type PaymentPeriod,
  buildPaymentDescription
} from "@/libs/payment-description"
import { collectReceivable } from "../receivable-actions"
import {
  type CollectableReceivable,
  MONTH_SHORTCUTS,
  amountForMonths,
  describeMonths,
  openPeriods,
  previewCollection,
  shortMonth
} from "../receivable-collect"
import {
  COLLECT_MODES_BY_SCHEDULE,
  type ReceivableCollectMode
} from "../receivable-schemas"
import type { PaymentFormState } from "../types"

const MODE_LABELS: Record<ReceivableCollectMode, string> = {
  partial: "Abono",
  full: "Pago completo",
  single: "Una cuota",
  allocate: "Varios meses"
}

/** Monto como texto, o `***` con las cifras ocultas */
function useMoney() {
  const { hidden } = useHideAmounts()
  return (value: number) => (hidden ? AMOUNT_MASK : formatCurrency(value))
}

interface ReceivableCollectFormProps {
  workspaceId: string
  /** Cuentas por cobrar activas que se pueden elegir */
  receivables: CollectableReceivable[]
  /** Cuenta por cobrar elegida al abrir. Con `fixed`, no se puede cambiar */
  receivableId?: string
  /** Sheet de la cuenta por cobrar: sin selector */
  fixed?: boolean
  /** Cuota elegida al abrir (Una cuota) */
  periodOn?: string
  /** Cuentas con saldo para la cuenta que recibe */
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Cobro de una cuenta por cobrar (SPEC 39). Lo comparten el tab Me deben del
 * diálogo de movimiento y el Sheet de la cuenta por cobrar:
 * - cobro único: Abono | Pago completo;
 * - mensual: Una cuota | Varios meses (reparto desde la cuota más antigua).
 * Crea un solo abono y, si se marca, un solo ingreso.
 */
export function ReceivableCollectForm({
  workspaceId,
  receivables,
  receivableId,
  fixed = false,
  periodOn,
  accounts,
  onSaved,
  onCancel
}: ReceivableCollectFormProps) {
  const [selectedId, setSelectedId] = useState(
    () => receivableId ?? receivables[0]?.id ?? ""
  )
  const receivable = receivables.find((option) => option.id === selectedId)

  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <ReceivableSelect
          receivables={receivables}
          value={selectedId}
          onChange={setSelectedId}
        />
      )}
      {receivable && (
        <CollectFields
          // Cambiar de cuenta por cobrar reinicia modo, cuota y monto
          key={receivable.id}
          workspaceId={workspaceId}
          receivable={receivable}
          periodOn={receivable.id === receivableId ? periodOn : undefined}
          accounts={accounts}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

interface ReceivableCollectDialogProps {
  workspaceId: string
  receivable: CollectableReceivable
  /** Cuota elegida al abrir (Una cuota) */
  periodOn?: string
  accounts: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Cobro desde el Sheet de una cuenta por cobrar: el mismo formulario del tab */
export function ReceivableCollectDialog({
  workspaceId,
  receivable,
  periodOn,
  accounts,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableCollectDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title="Registrar cobro"
      description={`Lo que te pagaron de ${receivable.name}.`}
    >
      {(close) => (
        <ReceivableCollectForm
          workspaceId={workspaceId}
          receivables={[receivable]}
          receivableId={receivable.id}
          fixed
          periodOn={periodOn}
          accounts={accounts}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

/** Saldo o "N cuotas por cobrar · $ Z" de una cuenta por cobrar */
function useReceivableSummary() {
  const money = useMoney()
  return (receivable: CollectableReceivable) => {
    if (receivable.schedule === "once") {
      return `Saldo ${money(receivable.balance ?? 0)}`
    }
    if (receivable.owedCount === 0) {
      return "Al día"
    }
    const noun = receivable.owedCount === 1 ? "cuota" : "cuotas"
    return `${receivable.owedCount} ${noun} por cobrar · ${money(receivable.owed)}`
  }
}

function ReceivableSelect({
  receivables,
  value,
  onChange
}: {
  receivables: CollectableReceivable[]
  value: string
  onChange: (value: string) => void
}) {
  const summary = useReceivableSummary()

  return (
    <SelectField
      label="Cuenta por cobrar"
      help="receivable.select"
      value={value}
      onChange={onChange}
      options={receivables.map((option) => ({
        value: option.id,
        label: option.name,
        description: summary(option)
      }))}
    />
  )
}

interface CollectFieldsProps {
  workspaceId: string
  receivable: CollectableReceivable
  periodOn?: string
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

function CollectFields({
  workspaceId,
  receivable,
  periodOn,
  accounts,
  onSaved,
  onCancel
}: CollectFieldsProps) {
  const money = useMoney()
  const summary = useReceivableSummary()
  const today = todayISO()
  const modes = COLLECT_MODES_BY_SCHEDULE[receivable.schedule]
  const open = openPeriods(receivable)
  const monthly = receivable.schedule === "monthly"

  const [mode, setMode] = useState<ReceivableCollectMode>(modes[0])
  // Una cuota: la elegida al abrir o la más antigua sin cubrir
  const [period, setPeriod] = useState(
    () =>
      open.find((item) => item.period_on === periodOn)?.period_on ??
      open[0]?.period_on ??
      ""
  )
  const remainingOf = (value: string) =>
    open.find((item) => item.period_on === value)?.remaining ?? null

  const [amountText, setAmountText] = useState(() =>
    monthly ? amountInput(remainingOf(period)) : ""
  )
  const [occurredOn, setOccurredOn] = useState(todayISO)
  const [createTransaction, setCreateTransaction] = useState(true)
  const fieldId = useId()
  const fullAmountLabelId = `${fieldId}-full-label`
  const fullAmountErrorId = `${fieldId}-full-error`
  const createTransactionId = `${fieldId}-create`

  const [state, formAction, pending] = useActionState<
    PaymentFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await collectReceivable(prevState, formData)
    if (result.ok) {
      toast.success(
        mode === "full" ? "Cuenta por cobrar pagada" : "Cobro registrado"
      )
      onSaved()
    }
    return result
  }, {})
  const errors = state.fieldErrors

  const isFull = mode === "full"
  const typedAmount = parsePaymentAmount(amountText)
  const amount = isFull ? receivable.balance : typedAmount
  const preview =
    mode === "allocate" && amount !== null && amount > 0
      ? previewCollection(receivable, amount)
      : null
  // El error del servidor manda; si no hay, el de la vista previa
  const amountError = errors?.amount?.[0] ?? preview?.error ?? undefined

  // Descripción del ingreso (SPEC 41): "Cobro {nombre} · {cuotas}". Sigue al
  // modo, la cuota y el monto mientras el usuario no la cambie
  const coveredPeriods =
    mode === "single"
      ? [period].filter(Boolean)
      : preview && !preview.error
        ? [
            ...preview.covered,
            ...(preview.partial ? [preview.partial.key] : [])
          ].sort()
        : []
  const collectPeriod: PaymentPeriod =
    coveredPeriods.length === 0
      ? { kind: "none" }
      : {
          kind: "range",
          from: coveredPeriods[0],
          to: coveredPeriods[coveredPeriods.length - 1]
        }
  const suggestedDescription = buildPaymentDescription(
    "Cobro",
    receivable.name,
    collectPeriod
  )
  const [typedDescription, setTypedDescription] = useState<string | null>(
    () => state.values?.description ?? null
  )
  const description = typedDescription ?? suggestedDescription
  // Nota del cobro en el historial: el mismo texto sugerido, que sigue al
  // modo y las cuotas mientras el usuario no la cambie
  const [typedNote, setTypedNote] = useState<string | null>(
    () => state.values?.note ?? null
  )
  const note = typedNote ?? suggestedDescription

  const changeMode = (next: ReceivableCollectMode) => {
    setMode(next)
    // Una cuota vuelve a prellenar con lo que falta de la cuota elegida
    if (next === "single") {
      setAmountText(amountInput(remainingOf(period)))
    }
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="debt_id"
        value={receivable.id}
      />
      <input
        type="hidden"
        name="mode"
        value={mode}
      />

      <div className="flex items-center gap-1">
        <ToggleGroup
          value={[mode]}
          onValueChange={(next) => {
            const [value] = next
            if (value) changeMode(value as ReceivableCollectMode)
          }}
          aria-label="Cómo se cobra"
          spacing={1}
          className={SEGMENT_TRACK_CLASS}
        >
          {modes.map((item) => (
            <ToggleGroupItem
              key={item}
              value={item}
              className={SEGMENT_ITEM_CLASS}
            >
              {MODE_LABELS[item]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldHelp
          help="receivable.collectHow"
          label="Cómo se cobra"
        />
      </div>

      {mode === "single" && (
        <input
          type="hidden"
          name="period_on"
          value={period}
        />
      )}
      {mode === "single" && (
        <SelectField
          label="Cuota"
          help="receivable.period"
          value={period}
          onChange={(next) => {
            setPeriod(next)
            setAmountText(amountInput(remainingOf(next)))
          }}
          options={open.map((item) => ({
            value: item.period_on,
            label: formatMonthTitle(item.period_on.slice(0, 7)),
            description: `Falta ${money(item.remaining)}`
          }))}
          error={errors?.period_on?.[0]}
        />
      )}

      {isFull ? (
        // Pago completo: el monto es el saldo pendiente y lo pone el servidor
        <div className="flex flex-col gap-2">
          <span
            id={fullAmountLabelId}
            className="text-sm font-medium"
          >
            Monto
          </span>
          <p
            aria-labelledby={fullAmountLabelId}
            aria-describedby={
              errors?.amount?.[0] ? fullAmountErrorId : undefined
            }
            className="flex min-h-11 items-center rounded-4xl bg-field px-4 text-base"
          >
            <Amount value={receivable.balance ?? 0} />
          </p>
          <FieldDescription>
            Es el saldo pendiente. La cuenta por cobrar queda pagada.
          </FieldDescription>
          {errors?.amount?.[0] && (
            <FieldError id={fullAmountErrorId}>{errors.amount[0]}</FieldError>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
            error={amountError}
          />

          {mode === "partial" && receivable.balance !== null && (
            <p className="text-sm text-muted-foreground">
              Saldo pendiente: <Amount value={receivable.balance} />
            </p>
          )}

          {mode === "allocate" && (
            <MonthShortcuts
              receivable={receivable}
              onPick={(value) => setAmountText(amountInput(value))}
            />
          )}

          {preview && !preview.error && (
            <p
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {preview.covered.length > 0 && (
                <>Cubre {describeMonths(preview.covered, today)}</>
              )}
              {preview.covered.length > 0 && preview.partial && " · "}
              {preview.partial && (
                <>
                  Abona <Amount value={preview.partial.amount} /> a{" "}
                  {shortMonth(preview.partial.key, today)} (falta{" "}
                  <Amount value={preview.partial.missing} />)
                </>
              )}
            </p>
          )}

          {mode === "allocate" && open.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {summary(receivable)}
            </p>
          )}
        </div>
      )}

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

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder={monthly ? "Plan de noviembre" : "Primer abono"}
        value={note}
        onChange={(event) => setTypedNote(event.target.value)}
        error={errors?.note?.[0]}
      />

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
          Registrar como entrada
        </Label>
        <FieldHelp
          help="debtEntry.createTransaction"
          label="Registrar el movimiento"
        />
      </div>

      {createTransaction && (
        <TextInputField
          name="description"
          label="Descripción"
          help="common.description"
          maxLength={120}
          placeholder="Cobro"
          value={description}
          onChange={(event) => setTypedDescription(event.target.value)}
          error={errors?.description?.[0]}
        />
      )}

      {/* La cuenta es la del ingreso: sin él no aplica. Muestra "Quedará en" */}
      {createTransaction && (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={amount}
          errors={{ account_id: errors?.account_id?.[0] }}
          label="Cuenta que recibe"
          accountHelp="receivable.collectAccount"
          direction="in"
          // Cuenta por defecto de la cuenta por cobrar, si sigue activa
          defaultAccountId={
            activeAccountId(accounts, receivable.accountId) ?? ""
          }
        />
      )}

      {(state.error ?? errors?.debt_id?.[0] ?? errors?.mode?.[0]) && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error ?? errors?.debt_id?.[0] ?? errors?.mode?.[0]}
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

/** "2 meses", "3 meses", "6 meses": llenan el monto con lo que falta */
function MonthShortcuts({
  receivable,
  onPick
}: {
  receivable: CollectableReceivable
  onPick: (amount: number) => void
}) {
  const options = MONTH_SHORTCUTS.map((months) => ({
    months,
    amount: amountForMonths(receivable, months)
  })).filter(
    (
      option
    ): option is { months: (typeof MONTH_SHORTCUTS)[number]; amount: number } =>
      option.amount !== null
  )

  if (options.length === 0) {
    return null
  }

  return (
    <div
      role="group"
      aria-label="Llenar con varios meses"
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => (
        <Button
          key={option.months}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(option.amount)}
        >
          {option.months} meses
        </Button>
      ))}
    </div>
  )
}
