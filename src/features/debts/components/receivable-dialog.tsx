"use client"

import { useActionState, useState } from "react"
import { AccountSelectField } from "@/components/forms/account-select-field"
import { FieldHelp } from "@/components/forms/field-label"
import { FormDialog } from "@/components/forms/form-dialog"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  type AccountOption,
  selectableAccounts
} from "@/features/accounts/components/account-select"
import { createDebt, updateDebt } from "../debt-actions"
import type { Debt } from "../queries"
import type { ReceivableSchedule } from "../receivable-schemas"
import type { DebtFormState } from "../types"
import {
  ReceivableDialogMonthlyFields,
  ReceivableDialogOnceFields
} from "./receivable-dialog-fields"

const SCHEDULE_OPTIONS = [
  { value: "once", label: "Una vez" },
  { value: "monthly", label: "Mes a mes" }
] as const satisfies readonly { value: ReceivableSchedule; label: string }[]

interface ReceivableDialogProps {
  /** Espacio (para crear una cuenta desde el select) */
  workspaceId: string
  /** Cuentas del espacio (cuenta por defecto); solo se ofrecen las activas */
  accounts: AccountOption[]
  /** Si llega, el diálogo edita esta cuenta por cobrar */
  receivable?: Debt
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReceivableDialog({
  workspaceId,
  accounts,
  receivable,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableDialogProps) {
  const isEditing = receivable !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={isEditing ? "Editar cuenta por cobrar" : "Nueva cuenta por cobrar"}
      description={
        isEditing
          ? "Cambia los datos de la cuenta por cobrar. Sus abonos y ajustes no cambian."
          : "Dinero que prestaste, que alguien te debe o que te pagan cada mes."
      }
    >
      {(close) => (
        <ReceivableForm
          workspaceId={workspaceId}
          accounts={accounts}
          receivable={receivable}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface ReceivableFormProps {
  workspaceId: string
  accounts: AccountOption[]
  receivable?: Debt
  onSaved: () => void
  onCancel: () => void
}

function ReceivableForm({
  workspaceId,
  accounts,
  receivable,
  onSaved,
  onCancel
}: ReceivableFormProps) {
  const isEditing = receivable !== undefined
  const submitLabel = isEditing ? "Guardar" : "Crear"
  // El tipo de cobro se elige al crear (SPEC 28); al editar se usa el
  // guardado y no se puede cambiar
  const [schedule, setSchedule] = useState<ReceivableSchedule>(
    receivable?.schedule ?? "once"
  )
  // Cuenta por defecto (SPEC 41): la que recibe los cobros. Solo activas; una
  // archivada se vacía
  const accountOptions = selectableAccounts(accounts)
  const [accountId, setAccountId] = useState(() =>
    accountOptions.some((account) => account.id === receivable?.account_id)
      ? (receivable?.account_id ?? "")
      : ""
  )

  const [state, formAction, pending] = useActionState<DebtFormState, FormData>(
    async (prevState, formData) => {
      const result = isEditing
        ? await updateDebt(prevState, formData)
        : await createDebt(prevState, formData)

      if (result.ok) {
        toast.success(
          isEditing
            ? "Cuenta por cobrar actualizada"
            : "Cuenta por cobrar creada"
        )
        onSaved()
      }
      return result
    },
    {}
  )

  const errors = state.fieldErrors
  const values = state.values

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
          value={receivable.id}
        />
      ) : (
        <>
          <input
            type="hidden"
            name="kind"
            value="receivable"
          />
          <input
            type="hidden"
            name="schedule"
            value={schedule}
          />
          <div className="flex items-center gap-1">
            <ToggleGroup
              value={[schedule]}
              onValueChange={(next) => {
                const [value] = next
                if (value) setSchedule(value as ReceivableSchedule)
              }}
              aria-label="Tipo de cobro"
              spacing={1}
              className={SEGMENT_TRACK_CLASS}
            >
              {SCHEDULE_OPTIONS.map((option) => (
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
              help="receivable.mode"
              label="Tipo de cobro"
            />
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          name="name"
          label="Nombre"
          help="receivable.name"
          maxLength={60}
          placeholder={schedule === "monthly" ? "Arriendo" : "Préstamo a Juan"}
          defaultValue={values?.name ?? receivable?.name}
          isRequired
          error={errors?.name?.[0]}
        />

        <TextInputField
          name="counterparty"
          label="Deudor (opcional)"
          help="receivable.debtor"
          maxLength={60}
          placeholder="Juan"
          defaultValue={values?.counterparty ?? receivable?.counterparty ?? ""}
          error={errors?.counterparty?.[0]}
        />
      </div>

      {schedule === "monthly" ? (
        <ReceivableDialogMonthlyFields
          receivable={receivable}
          errors={errors}
          values={values}
        />
      ) : (
        <ReceivableDialogOnceFields
          receivable={receivable}
          errors={errors}
          values={values}
        />
      )}

      <AccountSelectField
        name="account_id"
        label="Cuenta por defecto (opcional)"
        help="common.defaultAccount"
        value={accountId}
        onChange={setAccountId}
        accounts={accountOptions}
        workspaceId={workspaceId}
        allowNone
        error={errors?.account_id?.[0]}
      />

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
