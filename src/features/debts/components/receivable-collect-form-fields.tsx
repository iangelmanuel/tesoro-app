"use client"

import { useId, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldHelp } from "@/components/forms/field-label"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { activeAccountId } from "@/features/accounts/active-account"
import {
  type PaymentAccountOption,
  PaymentAccountSection
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { formatMonthTitle } from "@/libs/format"
import {
  type CollectableReceivable,
  describeMonths,
  shortMonth
} from "../receivable-collect"
import {
  COLLECT_MODE_LABELS,
  monthShortcutOptions
} from "../receivable-collect-form-values"
import type { ReceivableCollectMode } from "../receivable-schemas"
import { CreateTransactionCheckbox } from "./create-transaction-checkbox"
import {
  useMoney,
  useReceivableCollectForm,
  useReceivableSummary
} from "./use-receivable-collect-form"

interface ReceivableCollectFormFieldsProps {
  workspaceId: string
  receivable: CollectableReceivable
  periodOn?: string
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Campos del cobro de una cuenta por cobrar: modo, cuota, monto con la vista
 * previa del reparto, fecha, nota y el ingreso con su cuenta (SPEC 39)
 */
export function ReceivableCollectFormFields({
  workspaceId,
  receivable,
  periodOn,
  accounts,
  onSaved,
  onCancel
}: ReceivableCollectFormFieldsProps) {
  const money = useMoney()
  const summary = useReceivableSummary()
  const today = todayISO()
  const {
    modes,
    open,
    monthly,
    mode,
    changeMode,
    period,
    changePeriod,
    amountText,
    setAmountText,
    state,
    formAction,
    pending,
    isFull,
    amount,
    preview,
    amountError,
    description,
    setTypedDescription,
    note,
    setTypedNote
  } = useReceivableCollectForm({ receivable, periodOn, onSaved })
  const errors = state.fieldErrors
  const [occurredOn, setOccurredOn] = useState(todayISO)
  const [createTransaction, setCreateTransaction] = useState(true)
  const fieldId = useId()
  const fullAmountLabelId = `${fieldId}-full-label`
  const fullAmountErrorId = `${fieldId}-full-error`

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
              {COLLECT_MODE_LABELS[item]}
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
          onChange={changePeriod}
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
        maxValue={today}
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

      <CreateTransactionCheckbox
        checked={createTransaction}
        onCheckedChange={setCreateTransaction}
        income={true}
      />

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
  const options = monthShortcutOptions(receivable)

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
