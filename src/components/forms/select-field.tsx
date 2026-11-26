"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { FieldDescription, FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"

export interface SelectFieldOption<T extends string> {
  value: T
  label: string
  /** Texto de apoyo bajo la etiqueta, solo en la lista */
  description?: string
  /** Se ve en la lista pero no se puede elegir */
  disabled?: boolean
}

interface SelectFieldProps<T extends string> {
  /** Si llega, el formulario recibe el valor con este nombre */
  name?: string
  /** Etiqueta visible del campo */
  label: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
  /** Opción elegida */
  value: T
  /** Recibe la opción elegida */
  onChange: (value: T) => void
  /** Opciones de la lista, con `description` opcional */
  options: readonly SelectFieldOption<T>[]
  /** Error de Zod del campo */
  error?: string
  /** Bloquea el campo */
  disabled?: boolean
  /** Texto del trigger sin valor elegido */
  placeholder?: string
  /** Asterisco en la etiqueta. No activa la validación del navegador */
  isRequired?: boolean
  /** Texto de apoyo bajo el campo */
  description?: React.ReactNode
  /** Clases del contenedor del campo */
  className?: string
}

/**
 * Select corto (sin búsqueda) de los formularios: FieldLabel + Select de
 * `ui/` + FieldError. Para listas largas o con "+ Crear", CreatableSelect.
 * Valida el servidor: el error se anuncia con aria-invalid +
 * aria-describedby
 */
export function SelectField<T extends string>({
  name,
  label,
  help,
  value,
  onChange,
  options,
  error,
  disabled,
  placeholder,
  isRequired,
  description,
  className
}: SelectFieldProps<T>) {
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const describedIds = [
    error ? errorId : null,
    description ? descriptionId : null
  ]
    .filter(Boolean)
    .join(" ")
  // Sin `|| undefined`: el React Compiler no compila un `||` con ternarios
  const describedBy = describedIds === "" ? undefined : describedIds

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-invalid={error ? true : undefined}
    >
      <FieldLabel
        htmlFor={id}
        help={help}
        isRequired={isRequired}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <Select
        name={name}
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next != null) onChange(next as T)
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.description ? (
                <span className="flex flex-col py-0.5 whitespace-normal">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {option.description}
                  </span>
                </span>
              ) : (
                option.label
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  )
}
