"use client"

import { useActionState, useState } from "react"
import {
  Button,
  Checkbox,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Tabs,
  TextField,
  toast
} from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { useHideAmounts } from "@/components/dashboard/hide-amounts-context"
import { DatePickerField } from "@/components/forms/date-picker-field"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { AMOUNT_MASK, formatCurrency } from "@/libs/format"
import { collectReceivable } from "../actions"
import { formatMonthYear } from "../calculations"
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
} from "../schemas"
import type { PaymentFormState } from "../types"
import { amountInput } from "./field"

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
    <Select
      fullWidth
      placeholder="Elige a quién le cobras"
      value={value || null}
      onChange={(key) => onChange(key == null ? "" : String(key))}
      className="flex flex-col gap-2"
    >
      <Label>Cuenta por cobrar</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {receivables.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={option.name}
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{option.name}</span>
                <span className="text-xs text-muted tabular-nums">
                  {summary(option)}
                </span>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
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

      <Tabs
        selectedKey={mode}
        onSelectionChange={(key) => changeMode(key as ReceivableCollectMode)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Cómo se cobra">
            {modes.map((item) => (
              <Tabs.Tab
                key={item}
                id={item}
              >
                {MODE_LABELS[item]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {mode === "single" && (
        <input
          type="hidden"
          name="period_on"
          value={period}
        />
      )}
      {mode === "single" && (
        <Select
          fullWidth
          placeholder="Elige la cuota"
          value={period || null}
          onChange={(key) => {
            const next = key == null ? "" : String(key)
            setPeriod(next)
            setAmountText(amountInput(remainingOf(next)))
          }}
          isInvalid={Boolean(errors?.period_on)}
          className="flex flex-col gap-2"
        >
          <Label>Cuota</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {open.map((item) => (
                <ListBox.Item
                  key={item.period_on}
                  id={item.period_on}
                  textValue={formatMonthYear(item.period_on.slice(0, 7))}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="first-letter:uppercase">
                      {formatMonthYear(item.period_on.slice(0, 7))}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      Falta {money(item.remaining)}
                    </span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.period_on?.[0]}</FieldError>
        </Select>
      )}

      {isFull ? (
        // Pago completo: el monto es el saldo pendiente y lo pone el servidor
        <div className="flex flex-col gap-2">
          <Label id="full-amount-label">Monto</Label>
          <p
            aria-labelledby="full-amount-label"
            className="rounded-2xl bg-default px-3 py-2 text-base"
          >
            <Amount value={receivable.balance ?? 0} />
          </p>
          <p className="text-sm text-muted">
            Es el saldo pendiente. La cuenta por cobrar queda pagada.
          </p>
          {errors?.amount?.[0] && (
            <p className="text-sm text-danger">{errors.amount[0]}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <TextField
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={setAmountText}
            isRequired
            isInvalid={Boolean(amountError)}
            validationBehavior="aria"
            className="flex flex-col gap-2"
          >
            <Label>Monto</Label>
            <Input placeholder="0" />
            <FieldError>{amountError}</FieldError>
          </TextField>

          {mode === "partial" && receivable.balance !== null && (
            <p className="text-sm text-muted">
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
              className="text-sm text-muted"
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
            <p className="text-sm text-muted">{summary(receivable)}</p>
          )}
        </div>
      )}

      <DatePickerField
        name="occurred_on"
        label="Fecha"
        value={occurredOn}
        onChange={setOccurredOn}
        error={errors?.occurred_on?.[0]}
        maxValue={todayISO()}
        isRequired
      />

      <TextField
        name="note"
        maxLength={120}
        defaultValue={state.values?.note ?? ""}
        isInvalid={Boolean(errors?.note)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nota (opcional)</Label>
        <Input placeholder={monthly ? "Plan de noviembre" : "Primer abono"} />
        <FieldError>{errors?.note?.[0]}</FieldError>
      </TextField>

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
          Registrar como ingreso
        </Checkbox.Content>
      </Checkbox>

      {/* La cuenta es la del ingreso: sin él no aplica. Muestra "Quedará en" */}
      {createTransaction && (
        <PaymentAccountSection
          workspaceId={workspaceId}
          accounts={accounts}
          amount={amount}
          errors={{ account_id: errors?.account_id?.[0] }}
          label="Cuenta que recibe"
          direction="in"
        />
      )}

      {(state.error ?? errors?.debt_id?.[0] ?? errors?.mode?.[0]) && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error ?? errors?.debt_id?.[0] ?? errors?.mode?.[0]}
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
          variant="outline"
          size="sm"
          className="min-h-11 md:min-h-8"
          onPress={() => onPick(option.amount)}
        >
          {option.months} meses
        </Button>
      ))}
    </div>
  )
}
