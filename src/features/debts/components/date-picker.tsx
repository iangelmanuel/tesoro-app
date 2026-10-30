"use client"

import { useState } from "react"
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

/** Selector de fecha que solo deja elegir fechas hasta hoy */
export function PastDatePicker({
  id,
  value,
  onChange
}: {
  id: string
  /** YYYY-MM-DD */
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = toLocalDate(value)

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
          className="justify-start font-normal"
        >
          <CalendarIcon data-icon="inline-start" />
          {formatDate(value)}
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
          disabled={(date) => fromLocalDate(date) > todayISO()}
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
