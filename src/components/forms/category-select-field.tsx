"use client"

import { useState } from "react"
import { FieldError, Label, ListBox, Select } from "@heroui/react"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { CategoryDialog } from "@/features/categories/components/category-dialog"
import type { Category } from "@/features/categories/queries"
import { CREATE_OPTION, CreateOption } from "./create-option"

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
  /** Ayuda o aviso debajo del campo */
  children?: React.ReactNode
}

/**
 * Select de categoría con "+ Crear categoría" al final. La opción abre el
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

  function handleChange(key: React.Key | null) {
    if (key === CREATE_OPTION) {
      setDialogOpen(true)
      return
    }
    onChange(key == null ? "" : String(key))
  }

  function handleCreated(category: Category) {
    setCreated((current) => [...current, category])
    onChange(category.id)
  }

  return (
    <>
      <Select
        name={name}
        fullWidth
        placeholder={placeholder}
        value={value || null}
        onChange={handleChange}
        isInvalid={Boolean(error)}
        isDisabled={isDisabled}
        className="flex flex-col gap-2"
      >
        <Label>{label}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((category) => {
              const categoryName = category.archived_at
                ? `${category.name} (archivada)`
                : category.name
              return (
                <ListBox.Item
                  key={category.id}
                  id={category.id}
                  textValue={categoryName}
                >
                  <CategoryBadge
                    name={categoryName}
                    icon={category.icon}
                    color={category.color}
                  />
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              )
            })}
            <CreateOption label="Crear categoría" />
          </ListBox>
        </Select.Popover>
        <FieldError>{error}</FieldError>
        {children}
      </Select>
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
