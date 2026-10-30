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
import { Field } from "@/features/debts/components/field"
import { formatCurrency } from "@/libs/format"
import { adjustAccountBalance } from "../actions"
import type { AccountWithBalance, AdjustAccountFormState } from "../types"

interface AdjustBalanceDialogProps {
  account: Pick<AccountWithBalance, "id" | "name" | "balance">
  currency: string
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar saldo de {account.name}</DialogTitle>
          <DialogDescription>
            Saldo actual: {formatCurrency(account.balance, currency)}. Escribe
            el saldo real que ves en tu banco o billetera. No crea un
            movimiento.
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <AdjustBalanceForm
          accountId={account.id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface AdjustBalanceFormProps {
  accountId: string
  onSaved: () => void
  onCancel: () => void
}

function AdjustBalanceForm({
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
        name="account_id"
        value={accountId}
      />

      <Field
        id="balance"
        label="Saldo real"
        errors={errors?.balance}
      >
        <Input
          id="balance"
          name="balance"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          defaultValue={values?.balance ?? ""}
          aria-invalid={Boolean(errors?.balance) || undefined}
          required
        />
      </Field>

      <Field
        id="note"
        label="Nota (opcional)"
        errors={errors?.note}
      >
        <Input
          id="note"
          name="note"
          maxLength={120}
          placeholder="Cuadre con la app"
          defaultValue={values?.note ?? ""}
          aria-invalid={Boolean(errors?.note) || undefined}
        />
      </Field>

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
          {pending ? "Guardando..." : "Actualizar"}
        </Button>
      </DialogFooter>
    </form>
  )
}
