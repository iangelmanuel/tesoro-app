"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SITE } from "@/config/site"
import { Field } from "@/features/debts/components/field"
import { createBusiness, updateBusiness } from "../actions"
import type { BusinessFormState } from "../types"

/** Datos de una empresa que se pueden editar */
export interface EditableBusiness {
  id: string
  name: string
  taxId: string | null
  sector: string
}

interface BusinessDialogProps {
  /** Si llega, el diálogo edita esta empresa */
  business?: EditableBusiness
  /** Botón que abre el diálogo */
  trigger: React.ReactNode
}

export function BusinessDialog({ business, trigger }: BusinessDialogProps) {
  const [open, setOpen] = useState(false)
  const isEditing = business !== undefined

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar empresa" : "Crear empresa"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Cambia los datos de tu empresa. Sus movimientos no cambian."
              : "Un espacio separado de tus finanzas personales para las ventas, costos y gastos de tu negocio."}
          </DialogDescription>
        </DialogHeader>
        {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
        <BusinessForm
          business={business}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

interface BusinessFormProps {
  business?: EditableBusiness
  onSaved?: () => void
  /** Si llega, muestra el botón Cancelar */
  onCancel?: () => void
}

/** Formulario de crear o editar empresa. Al crear, la action redirige */
export function BusinessForm({
  business,
  onSaved,
  onCancel
}: BusinessFormProps) {
  const isEditing = business !== undefined

  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateBusiness(prevState, formData)
      : await createBusiness(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Empresa actualizada" : "Empresa creada")
      onSaved?.()
    }
    return result
  }, {})

  const errors = state.fieldErrors
  const values = state.values
  const [sector, setSector] = useState(values?.sector ?? business?.sector ?? "")

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      {isEditing && (
        <input
          type="hidden"
          name="workspace_id"
          value={business.id}
        />
      )}

      <Field
        id="business_name"
        label="Nombre"
        errors={errors?.name}
      >
        <Input
          id="business_name"
          name="name"
          maxLength={60}
          placeholder="Panadería Ana"
          defaultValue={values?.name ?? business?.name}
          aria-invalid={Boolean(errors?.name) || undefined}
          required
        />
      </Field>

      <Field
        id="tax_id"
        label="NIT (opcional)"
        errors={errors?.tax_id}
      >
        <Input
          id="tax_id"
          name="tax_id"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          placeholder="900123456-7"
          defaultValue={values?.tax_id ?? business?.taxId ?? ""}
          aria-invalid={Boolean(errors?.tax_id) || undefined}
        />
      </Field>

      <Field
        id="sector"
        label="Sector"
        errors={errors?.sector}
      >
        <Select
          name="sector"
          value={sector}
          onValueChange={setSector}
        >
          <SelectTrigger
            id="sector"
            className="w-full"
            aria-invalid={Boolean(errors?.sector) || undefined}
          >
            <SelectValue placeholder="Elige un sector" />
          </SelectTrigger>
          <SelectContent>
            {SITE.businessSectors.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear empresa"}
        </Button>
      </div>
    </form>
  )
}
