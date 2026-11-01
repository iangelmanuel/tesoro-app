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
import { requestBusinessDeletion } from "../actions"
import type { BusinessFormState } from "../types"

interface DeleteBusinessDialogProps {
  business: { id: string; name: string }
}

// El botón se habilita solo con el nombre exacto; la action lo revalida
export function DeleteBusinessDialog({ business }: DeleteBusinessDialogProps) {
  const [confirmName, setConfirmName] = useState("")
  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(requestBusinessDeletion, {})

  const matches = confirmName.trim() === business.name

  return (
    <AlertDialog onOpenChange={() => setConfirmName("")}>
      <Button
        variant="danger"
        className="self-start"
      >
        <Trash2 />
        Eliminar empresa
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                ¿Eliminar {business.name}?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Sus movimientos, categorías y cuentas se borran para siempre en{" "}
                {SITE.workspaceDeletionGraceDays} días. Antes de eso puedes
                restaurarla. Mientras tanto no se puede modificar.
              </p>
              <form
                id="delete-business-form"
                action={formAction}
                className="flex flex-col gap-4"
                noValidate
              >
                <input
                  type="hidden"
                  name="workspace_id"
                  value={business.id}
                />
                <TextField
                  name="confirmName"
                  autoComplete="off"
                  value={confirmName}
                  onChange={setConfirmName}
                  isInvalid={Boolean(state.fieldErrors?.confirmName)}
                  validationBehavior="aria"
                  className="flex flex-col gap-2"
                >
                  <Label>{`Escribe ${business.name} para confirmar`}</Label>
                  <Input />
                  <FieldError>{state.fieldErrors?.confirmName?.[0]}</FieldError>
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
                form="delete-business-form"
                variant="danger"
                isDisabled={!matches || pending}
              >
                {pending ? "Eliminando..." : "Eliminar empresa"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
