"use client"

import { useState } from "react"
import { FieldError, Label, ListBox, Select } from "@heroui/react"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import {
  AccountLabel,
  type AccountOption,
  accountName
} from "@/features/accounts/components/account-select"
import { CREATE_OPTION, CreateOption } from "./create-option"

// "Sin cuenta" usa este centinela como clave y el campo oculto envía ""
const NONE = "__none__"

interface AccountSelectFieldProps {
  /** Nombre del campo del formulario */
  name: string
  /** Etiqueta visible del campo */
  label: string
  /** id de la cuenta, o "" sin cuenta */
  value: string
  onChange: (value: string) => void
  /** Cuentas activas, más la archivada que ya tenga la fila */
  accounts: AccountOption[]
  /** Espacio donde se crea la cuenta nueva */
  workspaceId: string
  /** Muestra la opción "Sin cuenta" */
  allowNone?: boolean
  placeholder?: string
  /** Error de Zod del campo */
  error?: string
}

/**
 * Select de cuenta con "+ Crear cuenta" al final. La opción abre el diálogo
 * de cuenta encima del formulario (una cuenta necesita tipo y saldo); al
 * guardar, la nueva queda elegida y el resto del formulario no se toca. El
 * valor viaja en un input oculto para poder enviar "" (sin cuenta).
 */
export function AccountSelectField({
  name,
  label,
  value,
  onChange,
  accounts,
  workspaceId,
  allowNone = false,
  placeholder = "Elige una cuenta",
  error
}: AccountSelectFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [created, setCreated] = useState<AccountOption[]>([])

  const options = [
    ...accounts,
    ...created.filter(
      (account) => !accounts.some((option) => option.id === account.id)
    )
  ]

  function handleChange(key: React.Key | null) {
    if (key === CREATE_OPTION) {
      setDialogOpen(true)
      return
    }
    onChange(key === NONE || key == null ? "" : String(key))
  }

  function handleCreated(account: AccountOption) {
    setCreated((current) => [...current, account])
    onChange(account.id)
  }

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value}
      />
      <Select
        fullWidth
        placeholder={placeholder}
        value={value || (allowNone ? NONE : null)}
        onChange={handleChange}
        isInvalid={Boolean(error)}
        className="flex flex-col gap-2"
      >
        <Label>{label}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {allowNone ? (
              <ListBox.Item
                id={NONE}
                textValue="Sin cuenta"
              >
                Sin cuenta
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ) : null}
            {options.map((account) => (
              <ListBox.Item
                key={account.id}
                id={account.id}
                textValue={accountName(account)}
              >
                <AccountLabel account={account} />
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
            <CreateOption label="Crear cuenta" />
          </ListBox>
        </Select.Popover>
        <FieldError>{error}</FieldError>
      </Select>
      <AccountDialog
        workspaceId={workspaceId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
