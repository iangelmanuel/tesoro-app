"use client"

import { useActionState, useState } from "react"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SITE } from "@/config/site"
import { Field } from "@/features/debts/components/field"
import { requestAccountDeletion } from "../actions"
import type { ProfileFormState } from "../types"

export function DeleteAccountDialog({ email }: { email: string }) {
  const [confirmEmail, setConfirmEmail] = useState("")
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(requestAccountDeletion, {})

  const matches = confirmEmail.trim() === email

  return (
    <AlertDialog onOpenChange={() => setConfirmEmail("")}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="self-start"
        >
          <Trash2 data-icon="inline-start" />
          Eliminar cuenta
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
          <AlertDialogDescription>
            Se cierra tu sesión y tu foto se borra ahora. Tus movimientos,
            cuentas, metas y demás datos se borran para siempre en{" "}
            {SITE.accountDeletionGraceDays} días. Antes de eso puedes
            restaurarla iniciando sesión.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          action={formAction}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field
            id="confirmEmail"
            label={`Escribe ${email} para confirmar`}
            errors={state.fieldErrors?.confirmEmail}
          >
            <Input
              id="confirmEmail"
              name="confirmEmail"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || pending}
            >
              {pending ? "Eliminando..." : "Eliminar cuenta"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
