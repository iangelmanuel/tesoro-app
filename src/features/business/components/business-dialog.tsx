"use client"

import { useActionState, useState } from "react"
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  toast
} from "@heroui/react"
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
    <Modal>
      {trigger}
      <Modal.Backdrop
        isOpen={open}
        onOpenChange={setOpen}
      >
        <Modal.Container scroll="outside">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {isEditing ? "Editar empresa" : "Crear empresa"}
              </Modal.Heading>
              <p className="text-sm text-muted">
                {isEditing
                  ? "Cambia los datos de tu empresa. Sus movimientos no cambian."
                  : "Un espacio separado de tus finanzas personales para las ventas, costos y gastos de tu negocio."}
              </p>
            </Modal.Header>
            <Modal.Body>
              {/* El contenido se desmonta al cerrar: cada apertura empieza limpia */}
              <BusinessForm
                business={business}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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

      <TextField
        name="name"
        maxLength={60}
        defaultValue={values?.name ?? business?.name}
        isRequired
        isInvalid={Boolean(errors?.name)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>Nombre</Label>
        <Input placeholder="Panadería Ana" />
        <FieldError>{errors?.name?.[0]}</FieldError>
      </TextField>

      <TextField
        name="tax_id"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        defaultValue={values?.tax_id ?? business?.taxId ?? ""}
        isInvalid={Boolean(errors?.tax_id)}
        validationBehavior="aria"
        className="flex flex-col gap-2"
      >
        <Label>NIT (opcional)</Label>
        <Input placeholder="900123456-7" />
        <FieldError>{errors?.tax_id?.[0]}</FieldError>
      </TextField>

      <Field
        id="sector"
        label="Sector"
        errors={errors?.sector}
      >
        <Select
          name="sector"
          value={sector || null}
          onChange={(key) => key != null && setSector(String(key))}
          fullWidth
          isInvalid={Boolean(errors?.sector)}
          placeholder="Elige un sector"
        >
          <Select.Trigger id="sector">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SITE.businessSectors.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={String(option.label)}
                >
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </Field>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            variant="ghost"
            onPress={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          isDisabled={pending}
        >
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear empresa"}
        </Button>
      </div>
    </form>
  )
}
