"use client"

import { useActionState, useState } from "react"
import { Trash2 } from "lucide-react"
import { TextInputField } from "@/components/forms/text-input-field"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { requestBusinessDeletion } from "../actions"
import type { BusinessFormState } from "../types"

interface DeleteBusinessDialogProps {
  business: { id: string; name: string }
}

// El botón se habilita solo con el nombre exacto; la action lo revalida.
// El formulario se desmonta al cerrar: cada apertura empieza vacía
export function DeleteBusinessDialog({ business }: DeleteBusinessDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            className="self-start"
          />
        }
      >
        <Trash2 />
        Eliminar empresa
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive-soft text-destructive-soft-foreground">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Eliminar {business.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus movimientos, categorías y cuentas se borran para siempre en{" "}
            {SITE.workspaceDeletionGraceDays} días. Antes de eso puedes
            restaurarla. Mientras tanto no se puede modificar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DeleteBusinessForm business={business} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBusinessForm({ business }: DeleteBusinessDialogProps) {
  const [confirmName, setConfirmName] = useState("")
  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(requestBusinessDeletion, {})

  const matches = confirmName.trim() === business.name

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input
        type="hidden"
        name="workspace_id"
        value={business.id}
      />
      <TextInputField
        name="confirmName"
        autoComplete="off"
        label={`Escribe ${business.name} para confirmar`}
        help="confirm.typeToDelete"
        helpLabel="Confirmación"
        value={confirmName}
        onChange={(event) => setConfirmName(event.target.value)}
        error={state.fieldErrors?.confirmName?.[0]}
      />
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
          {pending ? "Eliminando..." : "Eliminar empresa"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
