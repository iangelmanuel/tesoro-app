"use client"

import { useActionState } from "react"
import { Button, cn, toast } from "@heroui/react"
import { FormField } from "@/features/auth/components/form-field"
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

  return (
    <form
      action={formAction}
      className={cn(
        "flex flex-col gap-4",
        !inDialog && "rounded-xl border border-border p-4"
      )}
      // Puede abrirse encima de otro formulario (selects con creación): el
      // submit no debe propagarse por el árbol de React hasta el de abajo
      onSubmit={(event) => event.stopPropagation()}
      noValidate
    >
      {!inDialog && (
        <h3 className="text-sm font-medium">
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

      <FormField
        name="name"
        label="Nombre"
        maxLength={40}
        placeholder={type === "expense" ? "Mascotas" : "Arriendos"}
        defaultValue={
          state.values?.name ?? (isEditing ? category.name : undefined)
        }
        errors={state.fieldErrors?.name}
        required
      />

      <IconColorPicker
        defaultIcon={isEditing ? category.icon : undefined}
        defaultColor={isEditing ? category.color : undefined}
        iconErrors={state.fieldErrors?.icon}
        colorErrors={state.fieldErrors?.color}
      />

      {state.error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {(isEditing || inDialog) && (
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
          {pending ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
        </Button>
      </div>
    </form>
  )
}
