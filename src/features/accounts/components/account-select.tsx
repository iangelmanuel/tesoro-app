"use client"

import { FieldError, Label, ListBox, Select } from "@heroui/react"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import type { AccountWithBalance } from "../types"

// "Sin cuenta" usa este centinela como clave y el campo oculto envía ""
const NONE = "__none__"

export type AccountOption = Pick<
  AccountWithBalance,
  "id" | "name" | "icon" | "color" | "archived_at"
>

interface AccountSelectProps {
  /** Nombre del campo del formulario */
  name: string
  /** Etiqueta visible del campo */
  label: string
  /** id de la cuenta, o "" sin cuenta */
  value: string
  onChange: (value: string) => void
  /** Cuentas activas, más la archivada que ya tenga la fila */
  accounts: AccountOption[]
  /** Muestra la opción "Sin cuenta" */
  allowNone?: boolean
  placeholder?: string
  /** Error de Zod del campo */
  error?: string
}

// Select de HeroUI con la etiqueta y el error dentro. El valor viaja en un
// input oculto para poder enviar "" (sin cuenta)
export function AccountSelect({
  name,
  label,
  value,
  onChange,
  accounts,
  allowNone = false,
  placeholder = "Elige una cuenta",
  error
}: AccountSelectProps) {
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
        onChange={(key) =>
          onChange(key === NONE || key == null ? "" : String(key))
        }
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
            {accounts.map((account) => (
              <ListBox.Item
                key={account.id}
                id={account.id}
                textValue={accountName(account)}
              >
                <AccountLabel account={account} />
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <FieldError>{error}</FieldError>
      </Select>
    </>
  )
}

export function accountName(account: AccountOption) {
  return account.archived_at ? `${account.name} (archivada)` : account.name
}

export function AccountLabel({ account }: { account: AccountOption }) {
  return (
    <span className="flex items-center gap-2">
      <GoalIcon
        icon={account.icon}
        color={account.color}
        className="size-5 [&_svg]:size-3"
      />
      {accountName(account)}
    </span>
  )
}

/** Cuentas activas más la de `currentId`, si está archivada */
export function selectableAccounts<T extends AccountOption>(
  accounts: T[],
  currentId?: string | null
) {
  return accounts.filter(
    (account) => !account.archived_at || account.id === currentId
  )
}
