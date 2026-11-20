"use client"

import { useActionState, useState } from "react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { toast } from "@/components/ui/sonner"
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { amountInput } from "@/features/debts/components/field"
import { todayISO } from "@/libs/dates"
import { createAccount, updateAccount } from "../actions"
import { ACCOUNT_KINDS, ACCOUNT_KIND_META } from "../constants"
import type {
  AccountFormState,
  AccountKind,
  AccountRow,
  AccountWithBalance
} from "../types"

interface AccountDialogProps {
  /** Espacio de la cuenta */
  workspaceId: string
  /** Si llega, el diálogo edita esta cuenta */
  account?: AccountWithBalance
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Recibe la cuenta creada (selects con creación la dejan seleccionada) */
  onCreated?: (account: AccountRow) => void
}

export function AccountDialog({
  workspaceId,
  account,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated
}: AccountDialogProps) {
  const isEditing = account !== undefined

  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar cuenta" : "Nueva cuenta"}
      description={
        isEditing
          ? "Cambia los datos de la cuenta. Sus movimientos no cambian."
          : "Donde guardas tu plata: efectivo, un banco o una billetera como Nequi."
      }
    >
      {(close) => (
        <AccountForm
          workspaceId={workspaceId}
          account={account}
          onSaved={(created) => {
            if (created) onCreated?.(created)
            close()
          }}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

interface AccountFormProps {
  workspaceId: string
  account?: AccountWithBalance
  /** Recibe la cuenta creada (al editar no llega) */
  onSaved: (created?: AccountRow) => void
  onCancel: () => void
}

function AccountForm({
  workspaceId,
  account,
  onSaved,
  onCancel
}: AccountFormProps) {
  const isEditing = account !== undefined

  const [state, formAction, pending] = useActionState<
    AccountFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateAccount(prevState, formData)
      : await createAccount(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Cuenta actualizada" : "Cuenta creada")
      onSaved(result.account)
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [kind, setKind] = useState<AccountKind>(
    (values?.kind as AccountKind | undefined) ?? account?.kind ?? "wallet"
  )
  const [openingOn, setOpeningOn] = useState(
    values?.opening_balance_on ?? account?.opening_balance_on ?? ""
  )

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      // Puede abrirse encima de otro formulario (selects con creación): el
      // submit no debe propagarse por el árbol de React hasta el de abajo
      onSubmit={(event) => event.stopPropagation()}
      noValidate
    >
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      {isEditing && (
        <input
          type="hidden"
          name="id"
          value={account.id}
        />
      )}
      <input
        type="hidden"
        name="kind"
        value={kind}
      />

      <TextInputField
        name="name"
        label="Nombre"
        help="account.name"
        maxLength={40}
        placeholder="Nequi"
        defaultValue={values?.name ?? account?.name}
        isRequired
        error={errors?.name?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo"
          help="account.type"
          value={kind}
          onChange={setKind}
          options={ACCOUNT_KINDS.map((value) => ({
            value,
            label: ACCOUNT_KIND_META[value].label
          }))}
          error={errors?.kind?.[0]}
        />

        <TextInputField
          name="opening_balance"
          label="Saldo inicial"
          help="account.openingBalance"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          defaultValue={
            values?.opening_balance ?? amountInput(account?.opening_balance)
          }
          error={errors?.opening_balance?.[0]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <DatePickerField
          name="opening_balance_on"
          label="Fecha del saldo inicial"
          help="account.openingBalanceDate"
          value={openingOn}
          onChange={setOpeningOn}
          error={errors?.opening_balance_on?.[0]}
          maxValue={todayISO()}
        />
        <FieldDescription>
          Opcional. Sin fecha, el saldo inicial cuenta desde el primer
          movimiento.
        </FieldDescription>
      </div>

      {/* Al crear, cambiar el tipo reinicia el icono y el color a los del tipo */}
      <IconColorPicker
        key={isEditing ? account.id : kind}
        defaultIcon={
          values?.icon || account?.icon || ACCOUNT_KIND_META[kind].icon
        }
        defaultColor={
          values?.color || account?.color || ACCOUNT_KIND_META[kind].color
        }
        iconErrors={errors?.icon}
        colorErrors={errors?.color}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
