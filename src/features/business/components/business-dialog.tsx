"use client"

import { useActionState, useState } from "react"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import { SITE } from "@/config/site"
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
  trigger: React.ReactElement
}

const SECTOR_OPTIONS = SITE.businessSectors.map((option) => ({
  value: option.id as string,
  label: String(option.label)
}))

export function BusinessDialog({ business, trigger }: BusinessDialogProps) {
  const isEditing = business !== undefined

  return (
    <FormDialog
      trigger={trigger}
      title={isEditing ? "Editar empresa" : "Crear empresa"}
      description={
        isEditing
          ? "Cambia los datos de tu empresa. Sus movimientos no cambian."
          : "Un espacio separado de tus finanzas personales para las entradas y salidas de tu negocio."
      }
      className="sm:max-w-md"
    >
      {(close) => (
        <BusinessForm
          business={business}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
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

      <TextInputField
        name="name"
        label="Nombre"
        help="business.name"
        maxLength={60}
        placeholder="Panadería Ana"
        defaultValue={values?.name ?? business?.name}
        isRequired
        error={errors?.name?.[0]}
      />

      <TextInputField
        name="tax_id"
        label="NIT (opcional)"
        help="business.taxId"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        placeholder="900123456-7"
        defaultValue={values?.tax_id ?? business?.taxId ?? ""}
        error={errors?.tax_id?.[0]}
      />

      <SelectField
        name="sector"
        label="Sector"
        help="business.sector"
        value={sector}
        onChange={setSector}
        options={SECTOR_OPTIONS}
        placeholder="Elige un sector"
        error={errors?.sector?.[0]}
      />

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
