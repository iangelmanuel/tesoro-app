"use client"

import { ListBox } from "@heroui/react"
import { Plus } from "lucide-react"

/** Clave de la última opción: abre el diálogo y nunca queda como valor */
export const CREATE_OPTION = "__create__"

/** Última opción de los selects con creación ("+ Crear …") */
export function CreateOption({ label }: { label: string }) {
  return (
    <ListBox.Item
      id={CREATE_OPTION}
      textValue={label}
      className="font-medium text-accent-soft-foreground"
    >
      <span className="flex items-center gap-2">
        <Plus className="size-4" />
        {label}
      </span>
    </ListBox.Item>
  )
}
