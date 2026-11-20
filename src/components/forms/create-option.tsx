"use client"

import { Plus } from "lucide-react"
import { ComboboxItem } from "@/components/ui/combobox"

/** Clave de la última opción: abre el diálogo y nunca queda como valor */
export const CREATE_OPTION = "__create__"

/** Última opción de los selects con creación ("+ Crear …") */
export function CreateOption({ label }: { label: string }) {
  return (
    <ComboboxItem
      value={CREATE_OPTION}
      className="font-medium text-primary data-highlighted:text-primary"
    >
      <Plus
        aria-hidden
        className="size-4"
      />
      {label}
    </ComboboxItem>
  )
}
