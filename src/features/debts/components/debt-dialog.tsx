"use client"

import { useActionState, useId, useState } from "react"
import { HelpHint } from "@/components/dashboard/feedback/help-hint"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { amountInput, rateInput } from "@/components/forms/amount-format"
import { FieldHelp, FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS,
  SegmentedField
} from "@/components/forms/segmented-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FieldHelpKey } from "@/config/help"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import { cn } from "@/libs/cn"
import { createDebt, updateDebt } from "../actions"
import type { Debt } from "../queries"
import type { RateType } from "../schemas"
import type { DebtFormState } from "../types"

type PayableKind = "credit_card" | "loan"

const KIND_OPTIONS = [
  { value: "credit_card", label: "Tarjeta de crédito" },
  { value: "loan", label: "Préstamo" }
] as const satisfies readonly { value: PayableKind; label: string }[]

const RATE_TYPE_OPTIONS = [
  { value: "ea", label: "E.A." },
  { value: "mv", label: "M.V." }
] as const satisfies readonly { value: RateType; label: string }[]

interface DebtDialogProps {
  /** Espacio de la deuda (para crear una cuenta desde el select) */
  workspaceId: string
  /** Cuentas del espacio (cuenta por defecto); solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita esta tarjeta o préstamo */
  debt?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DebtDialog({
  workspaceId,
  accounts,
  debt,
  trigger,
  open,
  onOpenChange
}: DebtDialogProps) {
  const isEditing = debt !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      title={isEditing ? "Editar deuda" : "Nueva deuda"}
      description={
        isEditing
          ? "Cambia los datos de la deuda. Sus pagos y ajustes no cambian."
          : "Una tarjeta de crédito o un préstamo que estás pagando."
      }
    >
      {(close) => (
        <DebtForm
          workspaceId={workspaceId}
          accounts={accounts}
          debt={debt}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface DebtFormProps {
  workspaceId: string
  accounts: AccountOption[]
  debt?: Debt
  onSaved: () => void
  onCancel: () => void
}

function DebtForm({
  workspaceId,
  accounts,
  debt,
  onSaved,
  onCancel
}: DebtFormProps) {
  const isEditing = debt !== undefined
  // Cuenta por defecto (SPEC 41): solo activas; una archivada se vacía
  const accountOptions = selectableAccounts(accounts)
  const [accountId, setAccountId] = useState(() =>
    accountOptions.some((account) => account.id === debt?.account_id)
      ? (debt?.account_id ?? "")
      : ""
  )

  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateDebt(prevState, formData)
        : await createDebt(prevState, formData)

      if (result.ok) {
        toast.success(isEditing ? "Deuda actualizada" : "Deuda creada")
        onSaved()
      }
      return result
    },
    {}
  )

  const errors = state.fieldErrors
  const values = state.values

  // El tipo solo se elige al crear
  const [kind, setKind] = useState<PayableKind>(
    debt?.kind === "loan" || values?.kind === "loan" ? "loan" : "credit_card"
  )
  const [rateType, setRateType] = useState<RateType>(
    (values?.rate_type as RateType | undefined) || debt?.rate_type || "ea"
  )
  const isCard = kind === "credit_card"
  const rateId = useId()
  const rateErrorId = `${rateId}-error`
  const rateError = (errors?.interest_rate ?? errors?.rate_type)?.[0]

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
          value={debt.id}
        />
      ) : (
        <input
          type="hidden"
          name="kind"
          value={kind}
        />
      )}
      <input
        type="hidden"
        name="rate_type"
        value={rateType}
      />

      {!isEditing && (
        <SegmentedField
          label="Tipo"
          help="debt.kind"
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
          error={errors?.kind?.[0]}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="name"
          label="Nombre"
          help="debt.name"
          maxLength={60}
          placeholder={isCard ? "Visa" : "Crédito de vehículo"}
          defaultValue={values?.name ?? debt?.name}
          isRequired
          error={errors?.name?.[0]}
        />

        <TextInputField
          name="counterparty"
          label="Entidad (opcional)"
          help="debt.institution"
          maxLength={60}
          placeholder="Banco"
          defaultValue={values?.counterparty ?? debt?.counterparty ?? ""}
          error={errors?.counterparty?.[0]}
        />
      </div>

      <AccountSelectField
        name="account_id"
        label="Cuenta por defecto (opcional)"
        help="debt.defaultAccount"
        value={accountId}
        onChange={setAccountId}
        accounts={accountOptions}
        workspaceId={workspaceId}
        allowNone
        error={errors?.account_id?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          id="opening_balance"
          label={isEditing ? "Saldo inicial" : "Saldo actual"}
          help="debt.currentBalance"
          errors={errors?.opening_balance}
          defaultValue={
            values?.opening_balance ?? amountInput(debt?.opening_balance)
          }
          required
        />

        {isCard ? (
          <AmountField
            id="credit_limit"
            label="Cupo"
            help="debt.creditLimit"
            errors={errors?.credit_limit}
            defaultValue={
              values?.credit_limit ?? amountInput(debt?.credit_limit)
            }
            required
          />
        ) : (
          <AmountField
            id="installment"
            label="Cuota mensual"
            help="debt.monthlyInstallment"
            errors={errors?.installment}
            defaultValue={values?.installment ?? amountInput(debt?.installment)}
            required
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* min-w-0 en la celda y el input: sin él, el ancho intrínseco del
            input más el toggle desbordan la celda y el toggle se monta sobre
            Día de pago */}
        <div
          className="flex min-w-0 flex-col gap-2"
          data-invalid={rateError ? true : undefined}
        >
          {/* El label va sobre el campo y el tipo de tasa juntos: dentro del
              campo se partía en tres líneas */}
          <FieldLabel
            htmlFor={rateId}
            isRequired={!isCard}
            isInvalid={Boolean(rateError)}
            help="debt.interestRate"
            helpLabel="Tasa de interés"
          >
            {isCard ? "Tasa de interés (opcional)" : "Tasa de interés"}
          </FieldLabel>
          <div className="flex min-w-0 items-center gap-2">
            <Input
              id={rateId}
              name="interest_rate"
              inputMode="decimal"
              autoComplete="off"
              placeholder={isCard ? "28,5" : "0 si no tiene"}
              defaultValue={
                values?.interest_rate ?? rateInput(debt?.interest_rate)
              }
              aria-invalid={rateError ? true : undefined}
              aria-describedby={rateError ? rateErrorId : undefined}
              className="min-w-0 flex-1"
            />
            <ToggleGroup
              value={[rateType]}
              onValueChange={(next) => {
                const [value] = next
                if (value) setRateType(value as RateType)
              }}
              aria-label="Tipo de tasa"
              spacing={1}
              className={cn(SEGMENT_TRACK_CLASS, "h-11 w-auto shrink-0")}
            >
              {RATE_TYPE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={SEGMENT_ITEM_CLASS}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldHelp
              help="debt.rateType"
              label="Tipo de tasa"
            />
          </div>
          {rateError ? (
            <FieldError id={rateErrorId}>{rateError}</FieldError>
          ) : null}
        </div>

        <DayField
          id="due_day"
          label="Día de pago"
          help="debt.dueDay"
          errors={errors?.due_day}
          defaultValue={values?.due_day ?? debt?.due_day ?? undefined}
          required
        />
      </div>

      {isCard ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <AmountField
              id="min_payment"
              label="Pago mínimo (opcional)"
              help="debt.minimumPayment"
              errors={errors?.min_payment}
              defaultValue={
                values?.min_payment ?? amountInput(debt?.min_payment)
              }
            />
            <DayField
              id="closing_day"
              label="Día de corte (opcional)"
              help="debt.cutoffDay"
              errors={errors?.closing_day}
              defaultValue={
                values?.closing_day ?? debt?.closing_day ?? undefined
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">
                Cuota de manejo (opcional)
              </span>
              <HelpHint topic="maintenanceFee" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AmountField
                id="fee_amount"
                label="Monto mensual"
                help="debt.feeAmount"
                errors={errors?.fee_amount}
                defaultValue={
                  values?.fee_amount ?? amountInput(debt?.fee_amount)
                }
              />
              <DayField
                id="fee_day"
                label="Día de cobro"
                help="debt.feeDay"
                errors={errors?.fee_day}
                defaultValue={values?.fee_day ?? debt?.fee_day ?? undefined}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Desde hoy se cobra sola. No la registres a mano.
            </p>
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AmountField
            id="original_amount"
            label="Monto original (opcional)"
            help="debt.originalAmount"
            errors={errors?.original_amount}
            defaultValue={
              values?.original_amount ?? amountInput(debt?.original_amount)
            }
          />
          <TextInputField
            name="term_months"
            label="Plazo en meses (opcional)"
            help="debt.termMonths"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="36"
            defaultValue={
              values?.term_months ??
              (debt?.term_months != null ? String(debt.term_months) : undefined)
            }
            error={errors?.term_months?.[0]}
          />
        </div>
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}

function AmountField({
  id,
  label,
  errors,
  defaultValue,
  required,
  help
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue: string
  required?: boolean
  help?: FieldHelpKey
}) {
  return (
    <TextInputField
      name={id}
      label={label}
      help={help}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      defaultValue={defaultValue}
      isRequired={required}
      error={errors?.[0]}
    />
  )
}

function DayField({
  id,
  label,
  errors,
  defaultValue,
  required,
  help
}: {
  id: string
  label: string
  errors?: string[]
  defaultValue?: string | number
  required?: boolean
  help?: FieldHelpKey
}) {
  return (
    <TextInputField
      name={id}
      label={label}
      help={help}
      type="number"
      inputMode="numeric"
      min={1}
      max={31}
      placeholder="15"
      defaultValue={
        defaultValue === undefined ? undefined : String(defaultValue)
      }
      isRequired={required}
      error={errors?.[0]}
    />
  )
}
