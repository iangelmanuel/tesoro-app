"use client"

import { es } from "react-day-picker/locale"
import { Calendar } from "@/components/ui/calendar"
import { CALENDAR_CELL_CLASS } from "./date-picker-field"

interface DatePickerCalendarProps {
  selected: Date | undefined
  defaultMonth: Date | undefined
  startMonth: Date
  endMonth: Date
  disabled: ({ before: Date } | { after: Date })[]
  required?: boolean
  label: string
  onSelect: (date: Date | undefined) => void
}

/**
 * Calendario del DatePickerField (react-day-picker): lo carga el campo al
 * abrir el popover o al pasar por su botón (SPEC 56b)
 */
export function DatePickerCalendar({
  selected,
  defaultMonth,
  startMonth,
  endMonth,
  disabled,
  required,
  label,
  onSelect
}: DatePickerCalendarProps) {
  return (
    <Calendar
      mode="single"
      locale={es}
      weekStartsOn={1}
      captionLayout="dropdown"
      selected={selected}
      defaultMonth={defaultMonth}
      startMonth={startMonth}
      endMonth={endMonth}
      disabled={disabled}
      required={required}
      aria-label={label}
      autoFocus
      className={CALENDAR_CELL_CLASS}
      onSelect={onSelect}
    />
  )
}
