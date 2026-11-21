"use client"

import { useId } from "react"
import { X } from "lucide-react"
import { FieldLabel } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { FieldHelpKey } from "@/config/help"

interface TimePickerFieldProps {
  /** Nombre del campo: el formulario recibe la hora como HH:MM o "" */
  name: string
  /** Etiqueta visible (por defecto "Hora (opcional)") */
  label?: string
  /** Hora HH:MM (o HH:MM:SS), o "" sin hora */
  value: string
  /** Recibe la hora HH:MM, o "" con "Quitar hora" */
  onChange: (value: string) => void
  /** Error de Zod del campo */
  error?: string
  /** Clases del contenedor del campo */
  className?: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

// HH:MM o HH:MM:SS de Postgres → HH:MM del input; "" si no es una hora
function toInputValue(value: string) {
  const match = TIME_PATTERN.exec(value)
  return match ? `${match[1]}:${match[2]}` : ""
}

// Campo de hora opcional con el <input type="time"> nativo: accesible y con
// el selector del sistema en móvil. Trabaja con HH:MM, igual que la columna
// `time` de Postgres sin zona horaria. "" es "sin hora"; el botón de la
// derecha la quita una vez puesta. El navegador entrega "" mientras la hora
// esté a medias. Valida el servidor (timeSchema)
export function TimePickerField({
  name,
  label = "Hora (opcional)",
  value,
  onChange,
  error,
  className = "flex flex-col gap-2",
  help
}: TimePickerFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const time = toInputValue(value)

  return (
    <div
      className={className}
      data-invalid={error ? true : undefined}
    >
      <FieldLabel
        htmlFor={id}
        help={help}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="time"
          name={name}
          value={time}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="flex-1 tabular-nums scheme-light dark:scheme-dark [&::-webkit-calendar-picker-indicator]:opacity-70"
        />
        {time ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Quitar hora"
            onClick={() => onChange("")}
          >
            <X
              aria-hidden
              className="size-4"
            />
          </Button>
        ) : null}
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  )
}
