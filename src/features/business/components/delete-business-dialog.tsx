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
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className="self-start"
        >
          <Trash2 data-icon="inline-start" />
          Eliminar empresa
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {business.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus movimientos, categorías y cuentas se borran para siempre en{" "}
            {SITE.workspaceDeletionGraceDays} días. Antes de eso puedes
            restaurarla. Mientras tanto no se puede modificar.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
          <Field
            id="confirmName"
            label={`Escribe ${business.name} para confirmar`}
            errors={state.fieldErrors?.confirmName}
          >
            <Input
              id="confirmName"
              name="confirmName"
              autoComplete="off"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
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
              {pending ? "Eliminando..." : "Eliminar empresa"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
