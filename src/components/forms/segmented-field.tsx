"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { FieldError } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"

/** Pista de las tabs segmentadas (pill de 48 px), como en el diálogo de movimiento */
export const SEGMENT_TRACK_CLASS =
  "h-12 w-full rounded-4xl bg-subtle p-0.5 dark:bg-card"

/** Opción de las tabs segmentadas; la elegida se levanta sobre la pista */
export const SEGMENT_ITEM_CLASS =
  "h-full flex-1 px-3 data-pressed:bg-card data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-(--surface-shadow) dark:data-pressed:bg-highlight"

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedFieldProps<T extends string> {
  /** Si llega, el formulario recibe el valor con este nombre */
  name?: string
  label: string
  help?: FieldHelpKey
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  /** Error de Zod del campo (el primero) */
  error?: string
  disabled?: boolean
  className?: string
}

/**
 * Elección corta (2 o 3 opciones) como tabs segmentadas: FieldLabel +
 * ToggleGroup de `ui/` + FieldError. Siempre hay una opción elegida
 */
export function SegmentedField<T extends string>({
  name,
  label,
  help,
  value,
  onChange,
  options,
  error,
  disabled,
  className
}: SegmentedFieldProps<T>) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-invalid={error ? true : undefined}
    >
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      ) : null}
      <FieldLabel
        id={labelId}
        help={help}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <ToggleGroup
        value={[value]}
        onValueChange={(next) => {
          const [selected] = next
          if (selected) onChange(selected as T)
        }}
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
        spacing={1}
        className={SEGMENT_TRACK_CLASS}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={SEGMENT_ITEM_CLASS}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  )
}
