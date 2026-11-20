"use client"

import { useActionState, useId, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FieldLabel } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { createContribution, updateContribution } from "../actions"
import type { GoalContribution } from "../queries"
import type { ContributionKind } from "../schemas"
import type { ContributionFormState } from "../types"

const KIND_LABELS: Record<ContributionKind, string> = {
  deposit: "Aporte",
  withdrawal: "Retiro"
}

/** Meta que se puede elegir en el diálogo (acceso rápido del header) */
export interface GoalOption {
  id: string
  name: string
}

/**
 * Campos de un aporte o retiro que el diálogo edita. Movimientos (SPEC 26)
 * los arma desde su fila sin cargar el aporte completo
 */
export type EditableContribution = Pick<
  GoalContribution,
  "id" | "amount" | "occurred_on" | "occurred_time" | "note"
>

/**
 * Prellenado de un aporte o retiro nuevo (Duplicar, SPEC 49). El monto va
 * sin signo: el tipo lo da `kind`. Sin fecha ni hora: ocurre hoy. Una cuenta
 * archivada llega como null
 */
export interface ContributionInitialValues {
  amount: number
  account_id: string | null
  note: string
}

interface ContributionDialogProps {
  /** Espacio de la meta (para crear una cuenta desde el select) */
  workspaceId: string
  /** Meta fija. Sin ella, el diálogo deja elegir entre `goals` */
  goalId?: string
  /** Metas activas para elegir; se usa cuando no llega `goalId` */
  goals?: GoalOption[]
  /** Tipo inicial. Al editar se toma del signo del monto. */
  kind?: ContributionKind
  /** Si llega, el diálogo edita este aporte */
  contribution?: EditableContribution
  /** Prellenado de un aporte nuevo; se ignora al editar */
  initialValues?: ContributionInitialValues
  /** Cuentas con saldo para el aporte; solo al registrar */
  accounts?: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ContributionDialog({
  workspaceId,
  goalId,
  goals,
  kind = "deposit",
  contribution,
  initialValues,
  accounts = [],
  trigger,
  open: controlledOpen,
  onOpenChange
}: ContributionDialogProps) {
  const isEditing = contribution !== undefined
  const initialKind: ContributionKind = contribution
    ? contribution.amount < 0
      ? "withdrawal"
      : "deposit"
    : kind

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={
        isEditing
          ? `Editar ${KIND_LABELS[initialKind].toLowerCase()}`
          : initialKind === "withdrawal"
            ? "Retirar de la meta"
            : "Aportar a la meta"
      }
      description="Un aporte no es una salida. Con cuenta, solo mueve su saldo."
    >
      {(close) => (
        <ContributionForm
          workspaceId={workspaceId}
          goalId={goalId}
          goals={goals}
          initialKind={initialKind}
          contribution={contribution}
          initialValues={isEditing ? undefined : initialValues}
          accounts={accounts}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface ContributionFormProps {
  workspaceId: string
  goalId?: string
  goals?: GoalOption[]
  initialKind: ContributionKind
  contribution?: EditableContribution
  initialValues?: ContributionInitialValues
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

function ContributionForm({
  workspaceId,
  goalId,
  goals,
  initialKind,
  contribution,
  initialValues,
  accounts,
  onSaved,
  onCancel
}: ContributionFormProps) {
  const isEditing = contribution !== undefined
  const kindLabelId = useId()
  const [kind, setKind] = useState<ContributionKind>(initialKind)
  // Sin meta fija arranca con la primera de la lista
  const [selectedGoalId, setSelectedGoalId] = useState(
    () => goalId ?? goals?.[0]?.id ?? ""
  )
  const showGoalSelect = !isEditing && !goalId && goals !== undefined
  const [occurredOn, setOccurredOn] = useState(
    () => contribution?.occurred_on ?? todayISO()
  )
  const [time, setTime] = useState(
    () => contribution?.occurred_time?.slice(0, 5) ?? ""
  )

  const [state, formAction, pending] = useActionState<
    ContributionFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateContribution(prevState, formData)
      : await createContribution(prevState, formData)

    if (result.ok) {
      toast.success(
        isEditing
          ? `${KIND_LABELS[kind]} actualizado`
          : `${KIND_LABELS[kind]} registrado`
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [amountText, setAmountText] = useState(
    () =>
      values?.amount ??
      amountInput(
        contribution
          ? Math.abs(contribution.amount)
          : initialValues
            ? Math.abs(initialValues.amount)
            : null
      )
  )

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
          value={contribution.id}
        />
      ) : (
        <input
          type="hidden"
          name="goal_id"
          value={selectedGoalId}
        />
      )}

      {showGoalSelect && (
        <SelectField
          label="Meta"
          help="contribution.goal"
          value={selectedGoalId}
          onChange={setSelectedGoalId}
          options={goals.map((goal) => ({ value: goal.id, label: goal.name }))}
          error={errors?.goal_id?.[0]}
        />
      )}
      <input
        type="hidden"
        name="kind"
        value={kind}
      />

      <div className="flex flex-col gap-2">
        <FieldLabel
          id={kindLabelId}
          help="contribution.type"
        >
          Tipo
        </FieldLabel>
        <ToggleGroup
          value={[kind]}
          onValueChange={(next) => {
            const [value] = next
            if (value) setKind(value as ContributionKind)
          }}
          aria-labelledby={kindLabelId}
          spacing={1}
          className="h-12 w-full rounded-4xl bg-subtle p-0.5 dark:bg-card"
        >
          {(["deposit", "withdrawal"] as const).map((value) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="h-full flex-1 px-3 data-pressed:bg-card data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-(--surface-shadow) dark:data-pressed:bg-highlight"
            >
              {KIND_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

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

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder="Prima de diciembre"
        defaultValue={
          values?.note ?? contribution?.note ?? initialValues?.note ?? ""
        }
        error={errors?.note?.[0]}
      />

      {/* La cuenta se elige al registrar; al editar solo cambian monto, fecha y
          nota. Un retiro entra a la cuenta y no lleva traspaso */}
      {!isEditing && accounts.length > 0 && (
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
            kind === "withdrawal" ? "Cuenta que recibe" : "Cuenta que paga"
          }
          direction={kind === "withdrawal" ? "in" : "out"}
          defaultAccountId={initialValues?.account_id ?? ""}
        />
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
        </Button>
      </div>
    </form>
  )
}

/**
 * Tab "Meta" del diálogo de movimiento (SPEC 30): elegir una meta activa y
 * registrar el aporte o retiro en el mismo formulario de ContributionDialog
 */
export function GoalContributionPanel({
  workspaceId,
  goals,
  accounts,
  onSaved,
  onCancel
}: {
  workspaceId: string
  /** Metas activas; al menos una */
  goals: GoalOption[]
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}) {
  return (
    <ContributionForm
      workspaceId={workspaceId}
      goals={goals}
      initialKind="deposit"
      accounts={accounts}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
}

// Solo deja elegir fechas hasta hoy
