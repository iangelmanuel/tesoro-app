"use client"

import { useActionState, useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/libs/cn"
import { createCategory, updateCategory } from "../actions"
import type { Category } from "../queries"
import type { CategoryFormState } from "../types"
import { IconColorPicker } from "./icon-color-picker"

interface CategoryFormProps {
  workspaceId: string
  type: Category["type"]
  /** Categoría a editar; null crea una nueva */
  category: Category | null
  /** Recibe la categoría creada (al editar no llega) */
  onSaved: (created?: Category) => void
  onCancel: () => void
  /**
   * Dentro de un diálogo (selects con creación): sin marco ni título propio
   * (lo pone el diálogo) y con "Cancelar" también al crear
   */
  inDialog?: boolean
}

export function CategoryForm({
  workspaceId,
  type,
  category,
  onSaved,
  onCancel,
  inDialog = false
}: CategoryFormProps) {
  const id = useId()
  const isEditing = category !== null && category.type === type

  const [state, formAction, pending] = useActionState<
    CategoryFormState,
    FormData
  >(async (prevState, formData) => {
    const result = isEditing
      ? await updateCategory(prevState, formData)
      : await createCategory(prevState, formData)

    if (result.ok) {
      toast.success(isEditing ? "Categoría actualizada" : "Categoría creada")
      onSaved(result.category)
    }
    return result
  }, {})

  const nameError = state.fieldErrors?.name?.[0]

  return (
    <form
      action={formAction}
      className={cn(
        "flex flex-col gap-5",
        !inDialog && "rounded-3xl bg-subtle p-4"
      )}
      // Puede abrirse encima de otro formulario (selects con creación): el
      // submit no debe propagarse por el árbol de React hasta el de abajo
      onSubmit={(event) => event.stopPropagation()}
      noValidate
    >
      {!inDialog && (
        <h3 className="text-sm font-semibold">
          {isEditing ? `Editar "${category.name}"` : "Nueva categoría"}
        </h3>
      )}

      {isEditing && (
        <input
          type="hidden"
          name="id"
          value={category.id}
        />
      )}
      <input
        type="hidden"
        name="workspace_id"
        value={workspaceId}
      />
      <input
        type="hidden"
        name="type"
        value={type}
      />

      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={`${id}-name`}
          help="category.name"
          isRequired
          isInvalid={Boolean(nameError)}
        >
          Nombre
        </FieldLabel>
        <Input
          id={`${id}-name`}
          name="name"
          maxLength={40}
          placeholder={type === "expense" ? "Mascotas" : "Arriendos"}
          defaultValue={
            state.values?.name ?? (isEditing ? category.name : undefined)
          }
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
        />
        {nameError ? (
          <FieldError id={`${id}-name-error`}>{nameError}</FieldError>
        ) : null}
      </div>

      <IconColorPicker
        defaultIcon={isEditing ? category.icon : undefined}
        defaultColor={isEditing ? category.color : undefined}
        iconErrors={state.fieldErrors?.icon}
        colorErrors={state.fieldErrors?.color}
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
        {(isEditing || inDialog) && (
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
