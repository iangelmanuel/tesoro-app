"use client"

import { useActionState, useState } from "react"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { TimePickerField } from "@/components/forms/time-picker-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { formatCurrency } from "@/libs/format"
import { adjustAccountBalance } from "../actions"
import type { AccountWithBalance, AdjustAccountFormState } from "../types"

interface AdjustBalanceDialogProps {
  account: Pick<AccountWithBalance, "id" | "workspace_id" | "name" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * "Actualizar saldo": el usuario escribe el saldo real (por ejemplo, el de la
 * app del banco) y se guarda un ajuste con fecha de hoy por la diferencia
 */
export function AdjustBalanceDialog({
  account,
  currency,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AdjustBalanceDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      title={`Actualizar saldo de ${account.name}`}
      description={
        <>
          Saldo actual:{" "}
          <span className="tabular-nums">
            {formatCurrency(account.balance, currency)}
          </span>
          . Escribe el saldo real que ves en tu banco o billetera. No crea un
          movimiento.
        </>
      }
    >
      {(close) => (
        <AdjustBalanceForm
          workspaceId={account.workspace_id}
          accountId={account.id}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface AdjustBalanceFormProps {
  workspaceId: string
  accountId: string
  onSaved: () => void
  onCancel: () => void
}

function AdjustBalanceForm({
  workspaceId,
  accountId,
  onSaved,
  onCancel
}: AdjustBalanceFormProps) {
  const [state, formAction, pending] = useActionState<
    AdjustAccountFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await adjustAccountBalance(prevState, formData)

    if (result.ok) {
      toast.success("Saldo actualizado")
      onSaved()
    }
    return result
  }, {})

  const [time, setTime] = useState("")
  const errors = state.fieldErrors
  const values = state.values

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="account_id"
        value={accountId}
      />

      <TextInputField
        name="balance"
        label="Saldo en tu banco"
        help="balance.real"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        defaultValue={values?.balance ?? ""}
        isRequired
        error={errors?.balance?.[0]}
      />

      <TimePickerField
        name="occurred_time"
        help="common.time"
        value={time}
        onChange={setTime}
        error={errors?.occurred_time?.[0]}
      />

      <TextInputField
        name="note"
        label="Nota (opcional)"
        help="common.note"
        maxLength={120}
        placeholder="Cuadre con la app"
        defaultValue={values?.note ?? ""}
        error={errors?.note?.[0]}
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
          {pending ? "Guardando..." : "Actualizar"}
        </Button>
      </div>
    </form>
  )
}
