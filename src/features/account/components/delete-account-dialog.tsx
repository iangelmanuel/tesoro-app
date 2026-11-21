"use client"

import { useActionState, useState } from "react"
import { Trash2 } from "lucide-react"
import { FormDialog } from "@/components/forms/form-dialog"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { requestAccountDeletion } from "../actions"
import type { ProfileFormState } from "../types"

// Pide escribir el email para confirmar, así que va en FormDialog y no en
// AlertDialog. El formulario se desmonta al cerrar: cada apertura empieza
// con el campo vacío
export function DeleteAccountDialog({ email }: { email: string }) {
  return (
    <FormDialog
      trigger={
        <Button
          variant="destructive"
          className="self-start"
        >
          <Trash2 />
          Eliminar cuenta
        </Button>
      }
      title="¿Eliminar tu cuenta?"
      description={`Se cierra tu sesión y tu foto se borra ahora. Tus movimientos, cuentas, metas y demás datos se borran para siempre en ${SITE.accountDeletionGraceDays} días. Antes de eso puedes restaurarla iniciando sesión.`}
      className="sm:max-w-md"
    >
      {(close) => (
        <DeleteAccountForm
          email={email}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

function DeleteAccountForm({
  email,
  onCancel
}: {
  email: string
  onCancel: () => void
}) {
  const [confirmEmail, setConfirmEmail] = useState("")
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(requestAccountDeletion, {})

  const matches = confirmEmail.trim() === email

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <TextInputField
        name="confirmEmail"
        type="email"
        autoComplete="off"
        label={`Escribe ${email} para confirmar`}
        help="confirm.typeToDelete"
        helpLabel="Confirmación"
        value={confirmEmail}
        onChange={(event) => setConfirmEmail(event.target.value)}
        error={state.fieldErrors?.confirmEmail?.[0]}
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
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={!matches || pending}
        >
          {pending ? "Eliminando..." : "Eliminar cuenta"}
        </Button>
      </div>
    </form>
  )
}
