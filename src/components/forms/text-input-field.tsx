"use client"

import { useId } from "react"
import { FieldLabel } from "@/components/forms/field-label"
import { FieldDescription, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"

type TextInputFieldProps = Omit<
  React.ComponentProps<"input">,
  "id" | "children"
> & {
  label: React.ReactNode
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
  /** Texto de la ayuda accesible cuando la etiqueta no es texto plano */
  helpLabel?: string
  /** Error de Zod del campo (el primero) */
  error?: string
  /** Asterisco en la etiqueta. No activa la validación del navegador */
  isRequired?: boolean
  /** Texto de apoyo bajo el campo */
  description?: React.ReactNode
  /** Clases del contenedor (Field) */
  className?: string
  /** Clases del <input> */
  inputClassName?: string
}

/**
 * Campo de texto de los formularios con useActionState: FieldLabel + Input
 * + FieldError de `ui/`. Valida el servidor (Zod): el error llega por
 * `error` y se anuncia con aria-invalid + aria-describedby. Los montos usan
 * este campo con inputMode="decimal" y conservan su texto tal cual; el
 * parseo es del esquema
 */
export function TextInputField({
  label,
  help,
  helpLabel,
  error,
  isRequired,
  description,
  className,
  inputClassName,
  ...inputProps
}: TextInputFieldProps) {
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
        helpLabel={helpLabel}
        isRequired={isRequired}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClassName}
        {...inputProps}
      />
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  )
}
