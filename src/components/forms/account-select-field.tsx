"use client"

import { useState } from "react"
import { CreatableSelect } from "@/components/forms/creatable-select"
import type { FieldHelpKey } from "@/config/help"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import {
  AccountLabel,
  type AccountOption,
  accountName
} from "@/features/accounts/components/account-select"

// "Sin cuenta" usa este centinela como clave y el campo oculto envía ""
const NONE = "__none__"

interface AccountSelectFieldProps {
  /** Nombre del campo del formulario */
  name: string
  /** Etiqueta visible del campo */
  label: string
  /** id de la cuenta, o "" sin cuenta */
  value: string
  /** Recibe el id elegido, o "" con "Sin cuenta" */
  onChange: (value: string) => void
  /** Cuentas activas, más la archivada que ya tenga la fila */
  accounts: AccountOption[]
  /** Espacio donde se crea la cuenta nueva */
  workspaceId: string
  /** Muestra la opción "Sin cuenta" */
  allowNone?: boolean
  /** Texto sin cuenta elegida (por defecto "Elige una cuenta") */
  placeholder?: string
  /** Error de Zod del campo */
  error?: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
}

/**
 * Select de cuenta con búsqueda y "+ Crear cuenta" al final. La opción abre el diálogo
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
  error,
  help
}: AccountSelectFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [created, setCreated] = useState<AccountOption[]>([])

  const options = [
    ...accounts,
    ...created.filter(
      (account) => !accounts.some((option) => option.id === account.id)
    )
  ]

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
      <CreatableSelect
        label={label}
        help={help}
        value={value || (allowNone ? NONE : null)}
        onChange={(key) => onChange(key === NONE ? "" : key)}
        onCreate={() => setDialogOpen(true)}
        options={[
          ...(allowNone
            ? [{ id: NONE, text: "Sin cuenta", node: "Sin cuenta" }]
            : []),
          ...options.map((account) => ({
            id: account.id,
            text: accountName(account),
            node: <AccountLabel account={account} />
          }))
        ]}
        createLabel="Crear cuenta"
        searchLabel="Buscar cuenta"
        placeholder={placeholder}
        error={error}
      />
      <AccountDialog
        workspaceId={workspaceId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
