"use client"

import { useActionState, useState } from "react"
import { amountInput } from "@/components/forms/amount-format"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { SegmentedField } from "@/components/forms/segmented-field"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import {
  type PaymentAccountOption,
  PaymentAccountSection,
  parsePaymentAmount
} from "@/features/accounts/components/payment-account-section"
import { todayISO } from "@/libs/dates"
import { createContribution, updateContribution } from "../actions"
import type { ContributionKind } from "../schemas"
import type { ContributionFormState } from "../types"
import type {
  ContributionInitialValues,
  EditableContribution,
  GoalOption
} from "./contribution-dialog"
import { KIND_LABELS } from "./contribution-kind"

const KIND_OPTIONS = (["deposit", "withdrawal"] as const).map((value) => ({
  value,
  label: KIND_LABELS[value]
}))

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

/** Formulario de aporte o retiro: lo carga ContributionDialog al abrir (SPEC 56b) */
export function ContributionForm({
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
        `${KIND_LABELS[kind]} ${isEditing ? "actualizado" : "registrado"}`
      )
      onSaved()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [amountText, setAmountText] = useState(() => {
    // Sin signo: el tipo lo da `kind`
    const amount = contribution?.amount ?? initialValues?.amount
    return (
      values?.amount ??
      amountInput(amount === undefined ? null : Math.abs(amount))
    )
  })
  const submitLabel = isEditing ? "Guardar" : "Registrar"

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

      <SegmentedField
        label="Tipo"
        help="contribution.type"
        value={kind}
        onChange={setKind}
        options={KIND_OPTIONS}
      />

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
          {pending ? "Guardando..." : submitLabel}
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
