"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { IconColorPicker } from "@/features/categories/components/icon-color-picker"
import { Field, amountInput } from "@/features/debts/components/field"
import { createAccount, updateAccount } from "../actions"
import { ACCOUNT_KINDS, ACCOUNT_KIND_META } from "../constants"
import type {
  AccountFormState,
  AccountKind,
  AccountWithBalance
} from "../types"

interface AccountDialogProps {
  /** Si llega, el diálogo edita esta cuenta */
  account?: AccountWithBalance
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AccountDialog({
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
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar cuenta" : "Nueva cuenta"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos de la cuenta. Sus movimientos no cambian."
              : "Donde guardas tu plata: efectivo, un banco o una billetera como Nequi."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <AccountForm
          account={account}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface AccountFormProps {
  account?: AccountWithBalance
  onSaved: () => void
  onCancel: () => void
}

function AccountForm({ account, onSaved, onCancel }: AccountFormProps) {
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

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
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

      <Field
        id="name"
        label="Nombre"
        errors={errors?.name}
      >
        <Input
          id="name"
          name="name"
          maxLength={40}
          placeholder="Nequi"
          defaultValue={values?.name ?? account?.name}
          aria-invalid={Boolean(errors?.name) || undefined}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="kind"
          label="Tipo"
          errors={errors?.kind}
        >
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as AccountKind)}
          >
            <SelectTrigger
              id="kind"
              className="w-full"
              aria-invalid={Boolean(errors?.kind) || undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_KINDS.map((value) => (
                <SelectItem
                  key={value}
                  value={value}
                >
                  {ACCOUNT_KIND_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="opening_balance"
          label="Saldo inicial"
          errors={errors?.opening_balance}
        >
          <Input
            id="opening_balance"
            name="opening_balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            defaultValue={
              values?.opening_balance ?? amountInput(account?.opening_balance)
            }
            aria-invalid={Boolean(errors?.opening_balance) || undefined}
          />
        </Field>
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

      <DialogFooter>
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
      </DialogFooter>
    </form>
  )
}
