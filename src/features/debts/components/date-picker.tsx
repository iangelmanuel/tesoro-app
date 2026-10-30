"use client"

import { useState } from "react"
import { cn } from "cn"
import { CalendarIcon } from "lucide-react"
import { es } from "react-day-picker/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { fromLocalDate, toLocalDate, todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"

interface DatePickerProps {
  id: string
  /** YYYY-MM-DD, o "" sin fecha */
  value: string
  onChange: (value: string) => void
  /** Por defecto solo deja elegir fechas hasta hoy (pagos y ajustes) */
  allowFuture?: boolean
  className?: string
}

export function DatePicker({
  id,
  value,
  onChange,
  allowFuture = false,
  className
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? toLocalDate(value) : undefined

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn("justify-start font-normal", className)}
        >
          <CalendarIcon data-icon="inline-start" />
          {value ? (
            formatDate(value)
          ) : (
            <span className="text-muted-foreground">Sin fecha</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
      >
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected}
          disabled={
            allowFuture ? undefined : (date) => fromLocalDate(date) > todayISO()
          }
          onSelect={(date) => {
            if (date) {
              onChange(fromLocalDate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
