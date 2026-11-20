"use client"

import { useState } from "react"
import { CreatableSelect } from "@/components/forms/creatable-select"
import type { FieldHelpKey } from "@/config/help"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { CategoryDialog } from "@/features/categories/components/category-dialog"
import type { Category } from "@/features/categories/queries"

interface CategorySelectFieldProps {
  /** Nombre del campo del formulario */
  name: string
  label?: string
  /** id de la categoría, o "" sin elegir */
  value: string
  onChange: (value: string) => void
  /** Opciones ya filtradas por el formulario (tipo, activas, etc.) */
  categories: Category[]
  /** Espacio donde se crea la categoría nueva */
  workspaceId: string
  /** Tipo del formulario: la categoría nueva lo hereda */
  type: Category["type"]
  placeholder?: string
  /** Error de Zod del campo */
  error?: string
  isDisabled?: boolean
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
  /** Ayuda o aviso debajo del campo */
  children?: React.ReactNode
}

/**
 * Select de categoría con búsqueda y "+ Crear categoría" al final. El valor
 * viaja en un input oculto. La opción abre el
 * diálogo de categoría encima del formulario; al guardar, la nueva queda
 * elegida y el resto del formulario no se toca. Mientras llega la lista
 * refrescada del servidor, la nueva vive en el estado local.
 */
export function CategorySelectField({
  name,
  label = "Categoría",
  value,
  onChange,
  categories,
  workspaceId,
  type,
  placeholder = "Elige una categoría",
  error,
  isDisabled,
  help,
  children
}: CategorySelectFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [created, setCreated] = useState<Category[]>([])

  const options = [
    ...categories,
    ...created.filter(
      (category) =>
        category.type === type &&
        !categories.some((option) => option.id === category.id)
    )
  ]

  function handleCreated(category: Category) {
    setCreated((current) => [...current, category])
    onChange(category.id)
  }

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value}
      />
      <CreatableSelect
        label={label}
        help={help}
        value={value || null}
        onChange={onChange}
        onCreate={() => setDialogOpen(true)}
        options={options.map((category) => {
          const categoryName = category.archived_at
            ? `${category.name} (archivada)`
            : category.name
          return {
            id: category.id,
            text: categoryName,
            node: (
              <CategoryBadge
                name={categoryName}
                icon={category.icon}
                color={category.color}
              />
            )
          }
        })}
        createLabel="Crear categoría"
        searchLabel="Buscar categoría"
        placeholder={placeholder}
        error={error}
        disabled={isDisabled}
      >
        {children}
      </CreatableSelect>
      <CategoryDialog
        workspaceId={workspaceId}
        type={type}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  )
}
