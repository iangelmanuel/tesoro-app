"use client"

import { Button, FieldError, Label, TimeField } from "@heroui/react"
import { Time } from "@internationalized/date"
import { X } from "lucide-react"

interface TimePickerFieldProps {
  /** Nombre del campo: el formulario recibe la hora como HH:MM o "" */
  name: string
  label?: string
  /** Hora HH:MM (o HH:MM:SS), o "" sin hora */
  value: string
  onChange: (value: string) => void
  /** Error de Zod del campo */
  error?: string
  className?: string
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

function toTime(value: string): Time | null {
  const match = TIME_PATTERN.exec(value)

  return match ? new Time(Number(match[1]), Number(match[2])) : null
}

// Hora completa en HH:MM; null si el usuario dejó segmentos a medias
function fromTime(time: Time | null) {
  if (!time) {
    return ""
  }

  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`
}

// Campo de hora opcional armado con el TimeField de HeroUI. Trabaja con
// HH:MM, igual que la columna `time` de Postgres sin zona horaria. "" es
// "sin hora"; el botón de la derecha la borra una vez puesta
export function TimePickerField({
  name,
  label = "Hora (opcional)",
  value,
  onChange,
  error,
  className = "flex flex-col gap-2"
}: TimePickerFieldProps) {
  const time = toTime(value)

  return (
    <TimeField
      name={name}
      value={time}
      onChange={(next) => onChange(fromTime(next))}
      granularity="minute"
      hourCycle={12}
      isInvalid={Boolean(error)}
      validationBehavior="aria"
      className={className}
    >
      <Label>{label}</Label>
      <TimeField.Group fullWidth>
        <TimeField.Input>
          {(segment) => <TimeField.Segment segment={segment} />}
        </TimeField.Input>
        {time ? (
          <TimeField.Suffix>
            <Button
              aria-label="Quitar la hora"
              className="min-h-11 min-w-11"
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onChange("")}
            >
              <X
                aria-hidden="true"
                className="size-4"
              />
            </Button>
          </TimeField.Suffix>
        ) : null}
      </TimeField.Group>
      <FieldError>{error}</FieldError>
    </TimeField>
  )
}
