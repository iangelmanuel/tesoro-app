"use client"

import { Fragment } from "react"
import { Plus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

/** Valor del "+ Crear …": abre el diálogo y nunca queda elegido */
const CREATE_VALUE = "__create__"

export interface RowTargetGroup {
  /** Encabezado del grupo ("Tus categorías"); sin él, opciones sueltas */
  label?: string
  options: { value: string; label: string }[]
}

interface RowTargetSelectProps {
  /** Nombre accesible: la fila ya muestra el valor del archivo */
  "aria-label": string
  value: string
  onChange: (value: string) => void
  /** Grupos separados por una línea, en orden */
  groups: RowTargetGroup[]
  /** Última opción "+ Crear …" que abre el diálogo de creación */
  createLabel?: string
  onCreate?: () => void
}

/**
 * Destino de una fila del asistente (categoría, cuenta, deuda o meta): un
 * Select de `ui/` sin etiqueta visible, con grupos, separadores y, si se
 * pide, "+ Crear …" al final
 */
export function RowTargetSelect({
  "aria-label": ariaLabel,
  value,
  onChange,
  groups,
  createLabel,
  onCreate
}: RowTargetSelectProps) {
  const visible = groups.filter((group) => group.options.length > 0)
  const items = visible.flatMap((group) => group.options)

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next == null) return
        if (next === CREATE_VALUE) onCreate?.()
        else onChange(String(next))
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="w-full sm:w-56"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {visible.map((group, index) => (
          <Fragment key={group.label ?? index}>
            {index > 0 && <SelectSeparator />}
            <SelectGroup>
              {group.label && <SelectLabel>{group.label}</SelectLabel>}
              {group.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        ))}
        {createLabel && onCreate && (
          <>
            <SelectSeparator />
            <SelectItem
              value={CREATE_VALUE}
              // --ring y no --primary: el tono del espacio no llega a AA
              // como texto sobre el popover oscuro (docs/ui.md)
              className="font-medium text-ring"
            >
              <Plus
                aria-hidden
                className="size-4"
              />
              {createLabel}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  )
}
