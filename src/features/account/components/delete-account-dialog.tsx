"use client"

import { useActionState, useState } from "react"
import {
  AlertDialog,
  Button,
  FieldError,
  Input,
  Label,
  TextField
} from "@heroui/react"
import { Trash2 } from "lucide-react"
import { SITE } from "@/config/site"
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
      <Button
        variant="danger"
        className="self-start"
      >
        <Trash2 />
        Eliminar cuenta
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Eliminar tu cuenta?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Se cierra tu sesión y tu foto se borra ahora. Tus movimientos,
                cuentas, metas y demás datos se borran para siempre en{" "}
                {SITE.accountDeletionGraceDays} días. Antes de eso puedes
                restaurarla iniciando sesión.
              </p>
              <form
                id="delete-account-form"
                action={formAction}
                className="flex flex-col gap-4"
                noValidate
              >
                <TextField
                  name="confirmEmail"
                  type="email"
                  autoComplete="off"
                  value={confirmEmail}
                  onChange={setConfirmEmail}
                  isInvalid={Boolean(state.fieldErrors?.confirmEmail)}
                  validationBehavior="aria"
                  className="flex flex-col gap-2"
                >
                  <Label>{`Escribe ${email} para confirmar`}</Label>
                  <Input />
                  <FieldError>
                    {state.fieldErrors?.confirmEmail?.[0]}
                  </FieldError>
                </TextField>
                {state.error && (
                  <p
                    role="alert"
                    className="text-sm text-danger"
                  >
                    {state.error}
                  </p>
                )}
              </form>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
                isDisabled={pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="delete-account-form"
                variant="danger"
                isDisabled={!matches || pending}
              >
                {pending ? "Eliminando..." : "Eliminar cuenta"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
