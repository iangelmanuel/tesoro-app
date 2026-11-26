"use client"

import { Suspense, useId, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { FieldLabel } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import { lazyWithPreload } from "@/libs/lazy-with-preload"

// react-day-picker se descarga al abrir el popover o al pasar por el botón
// de fecha (SPEC 56b). El botón muestra la fecha sin esperarlo
const DatePickerCalendar = lazyWithPreload(() =>
  import("./date-picker-calendar").then((m) => m.DatePickerCalendar)
)

/**
 * Tamaño de celda del calendario. Siete celdas de 44 px no caben en un
 * teléfono de 320 px: por debajo de ~350 px la celda se ajusta al ancho
 * (40 px a 320). Lo comparten el calendario y su hueco de carga
 */
export const CALENDAR_CELL_CLASS =
  "[--cell-size:min(--spacing(11),calc((100vw-2.5rem)/7))]"

/** Hueco del calendario: su padding, la fila del mes y 7 filas de celdas */
function CalendarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className={cn("p-3", CALENDAR_CELL_CLASS)}
    >
      <Skeleton className="h-[calc(var(--cell-size)*8)] w-[calc(var(--cell-size)*7)] rounded-2xl" />
    </div>
  )
}

interface DatePickerFieldProps {
  /** Nombre del campo: el formulario recibe la fecha como YYYY-MM-DD */
  name: string
  /** Etiqueta visible del campo */
  label: string
  /** Fecha YYYY-MM-DD, o "" sin fecha */
  value: string
  /** Recibe la fecha YYYY-MM-DD, o "" al borrarla */
  onChange: (value: string) => void
  /** Error de Zod del campo */
  error?: string
  /** Asterisco en la etiqueta */
  isRequired?: boolean
  /** Fecha mínima YYYY-MM-DD */
  minValue?: string
  /** Fecha máxima YYYY-MM-DD, p. ej. hoy para pagos y ajustes */
  maxValue?: string
  /** Clases del contenedor del campo */
  className?: string
  /** Ayuda del (?) junto a la etiqueta (FIELD_HELP) */
  help?: FieldHelpKey
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// YYYY-MM-DD → Date local a mediodía, solo para pintar el calendario. El
// mediodía evita que un cambio de horario corra el día
function toNoonDate(value: string | undefined) {
  if (!value || !ISO_DATE.test(value)) {
    return undefined
  }
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day, 12)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function fromDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const YEARS_AROUND = 10

// Campo de fecha: botón con la fecha y un Calendar (react-day-picker) en un
// Popover. Trabaja con fechas YYYY-MM-DD, igual que las columnas `date` de
// Postgres, así no hay conversiones de zona horaria. Valida el servidor: el
// error llega por `error` y se anuncia con aria-invalid + aria-describedby
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
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const errorId = `${id}-error`
  const [open, setOpen] = useState(false)

  const selected = toNoonDate(value)
  const min = toNoonDate(minValue)
  const max = toNoonDate(maxValue)
  const thisYear = new Date().getFullYear()
  const startMonth =
    min ?? new Date((selected?.getFullYear() ?? thisYear) - YEARS_AROUND, 0)
  const endMonth =
    max ?? new Date((selected?.getFullYear() ?? thisYear) + YEARS_AROUND, 11)

  const disabled = [
    ...(min ? [{ before: min }] : []),
    ...(max ? [{ after: max }] : [])
  ]

  return (
    <div
      className={className}
      data-invalid={error ? true : undefined}
    >
      <FieldLabel
        id={labelId}
        htmlFor={id}
        help={help}
        isRequired={isRequired}
        isInvalid={Boolean(error)}
      >
        {label}
      </FieldLabel>
      <input
        type="hidden"
        name={name}
        value={value}
      />
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger
          onPointerEnter={DatePickerCalendar.preload}
          onFocus={DatePickerCalendar.preload}
          render={
            <Button
              id={id}
              variant="ghost"
              aria-labelledby={`${labelId} ${valueId}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "w-full justify-between rounded-4xl border border-transparent bg-field px-4 font-normal tabular-nums hover:bg-field-hover aria-expanded:bg-field-hover aria-invalid:border-destructive",
                !selected && "text-muted-foreground"
              )}
            />
          }
        >
          <span
            id={valueId}
            className="truncate"
          >
            {selected ? formatDate(value) : "Elige una fecha"}
          </span>
          <CalendarIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto p-0"
        >
          <Suspense fallback={<CalendarSkeleton />}>
            <DatePickerCalendar.Component
              selected={selected}
              defaultMonth={selected ?? max ?? undefined}
              startMonth={startMonth}
              endMonth={endMonth}
              disabled={disabled}
              required={isRequired}
              label={label}
              onSelect={(date: Date | undefined) => {
                onChange(date ? fromDate(date) : "")
                setOpen(false)
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  )
}
