"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  toast
} from "@heroui/react"
import { DatePickerField } from "@/components/forms/date-picker-field"
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { amountInput } from "@/features/debts/components/field"
import { todayISO } from "@/libs/dates"
import { createAccount, updateAccount } from "../actions"
import { ACCOUNT_KINDS, ACCOUNT_KIND_META } from "../constants"
import type {
  AccountFormState,
  AccountKind,
  AccountWithBalance
} from "../types"

interface AccountDialogProps {
  /** Espacio de la cuenta */
  workspaceId: string
  /** Si llega, el diálogo edita esta cuenta */
  account?: AccountWithBalance
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AccountDialog({
  workspaceId,
  account,
  trigger,
  open: controlledOpen,
  onOpenChange
}: AccountDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const isEditing = account !== undefined

  return (
    <Modal
      isOpen={open}
      onOpenChange={setOpen}
    >
      {trigger}
      <Modal.Backdrop>
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar cuenta" : "Nueva cuenta"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de la cuenta. Sus movimientos no cambian."
                  : "Donde guardas tu plata: efectivo, un banco o una billetera como Nequi."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <AccountForm
                workspaceId={workspaceId}
                account={account}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

interface AccountFormProps {
  workspaceId: string
  account?: AccountWithBalance
  onSaved: () => void
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
      onSaved()
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

      <TextField
        name="name"
        maxLength={40}
        defaultValue={values?.name ?? account?.name}
        isRequired
        isInvalid={Boolean(errors?.name)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input placeholder="Nequi" />
        <FieldError>{errors?.name?.[0]}</FieldError>
      </TextField>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          fullWidth
          value={kind}
          onChange={(value) => value && setKind(value as AccountKind)}
          isInvalid={Boolean(errors?.kind)}
          className="flex flex-col gap-2"
        >
          <Label>Tipo</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ACCOUNT_KINDS.map((value) => (
                <ListBox.Item
                  key={value}
                  id={value}
                  textValue={ACCOUNT_KIND_META[value].label}
                >
                  {ACCOUNT_KIND_META[value].label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{errors?.kind?.[0]}</FieldError>
        </Select>

        <TextField
          name="opening_balance"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            values?.opening_balance ?? amountInput(account?.opening_balance)
          }
          isInvalid={Boolean(errors?.opening_balance)}
          validationBehavior="aria"
          className="flex flex-col gap-2"
        >
          <Label>Saldo inicial</Label>
          <Input placeholder="0" />
          <FieldError>{errors?.opening_balance?.[0]}</FieldError>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <DatePickerField
          name="opening_balance_on"
          label="Fecha del saldo inicial"
          value={openingOn}
          onChange={setOpeningOn}
          error={errors?.opening_balance_on?.[0]}
          maxValue={todayISO()}
        />
        <p className="text-xs text-muted">
          Opcional. Sin fecha, el saldo inicial cuenta desde el primer
          movimiento.
        </p>
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
          className="text-sm text-danger"
        >
          {state.error}
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
