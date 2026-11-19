"use client"

import { Calendar, DateField, DatePicker, FieldError } from "@heroui/react"
import { type CalendarDate, parseDate } from "@internationalized/date"
import { FieldLabel } from "@/components/forms/field-label"
import type { FieldHelpKey } from "@/config/help"

interface DatePickerFieldProps {
  /** Nombre del campo: el formulario recibe la fecha como YYYY-MM-DD */
  name: string
  label: string
  /** Fecha YYYY-MM-DD, o "" sin fecha */
  value: string
  onChange: (value: string) => void
  /** Error de Zod del campo */
  error?: string
  isRequired?: boolean
  /** Fecha mínima YYYY-MM-DD */
  minValue?: string
  /** Fecha máxima YYYY-MM-DD, p. ej. hoy para pagos y ajustes */
  maxValue?: string
  className?: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
}

function toCalendarDate(value: string): CalendarDate | null {
  try {
    return value ? parseDate(value) : null
  } catch {
    return null
  }
}

// Campo de fecha armado con el DatePicker y el Calendar de HeroUI. Trabaja
// con fechas YYYY-MM-DD, igual que las columnas `date` de Postgres, así no
// hay conversiones de zona horaria
export function DatePickerField({
  name,
  label,
  value,
  onChange,
  error,
  isRequired,
  minValue,
  maxValue,
  className = "flex flex-col gap-2",
  help
}: DatePickerFieldProps) {
  return (
    <DatePicker
      name={name}
      value={toCalendarDate(value)}
      onChange={(date) => onChange(date ? date.toString() : "")}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      minValue={minValue ? toCalendarDate(minValue) : undefined}
      maxValue={maxValue ? toCalendarDate(maxValue) : undefined}
      validationBehavior="aria"
      className={className}
    >
      <FieldLabel help={help}>{label}</FieldLabel>
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <FieldError>{error}</FieldError>
      <DatePicker.Popover>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  )
}
