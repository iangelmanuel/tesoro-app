"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { GoalIcon } from "@/features/goals/components/goal-icon"
import type { AccountWithBalance } from "../types"

// Radix Select no admite "" como valor: "Sin cuenta" usa este centinela y el
// campo oculto envía ""
const NONE = "__none__"

export type AccountOption = Pick<
  AccountWithBalance,
  "id" | "name" | "icon" | "color" | "archived_at"
>

interface AccountSelectProps {
  id: string
  /** Nombre del campo del formulario */
  name: string
  /** id de la cuenta, o "" sin cuenta */
  value: string
  onChange: (value: string) => void
  /** Cuentas activas, más la archivada que ya tenga la fila */
  accounts: AccountOption[]
  /** Muestra la opción "Sin cuenta" */
  allowNone?: boolean
  placeholder?: string
  invalid?: boolean
}

export function AccountSelect({
  id,
  name,
  value,
  onChange,
  accounts,
  allowNone = false,
  placeholder = "Elige una cuenta",
  invalid
}: AccountSelectProps) {
  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value}
      />
      <Select
        value={value || (allowNone ? NONE : "")}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-invalid={invalid || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>Sin cuenta</SelectItem>}
          {accounts.map((account) => (
            <SelectItem
              key={account.id}
              value={account.id}
            >
              <AccountLabel account={account} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export function AccountLabel({ account }: { account: AccountOption }) {
  return (
    <span className="flex items-center gap-2">
      <GoalIcon
        icon={account.icon}
        color={account.color}
        className="size-5 [&_svg]:size-3"
      />
      {account.archived_at ? `${account.name} (archivada)` : account.name}
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
