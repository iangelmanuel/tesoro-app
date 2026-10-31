"use client"

import { useState, useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { es } from "date-fns/locale"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { formatDate } from "@/libs/format"
import {
  type ReportParams,
  type ReportPeriod,
  type ReportQuery,
  buildReportQuery,
  currentPeriodValue,
  shiftPeriodValue
} from "../period"

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  month: "Mes",
  quarter: "Trimestre",
  year: "Año",
  range: "Rango"
}

const STEP_LABELS: Record<
  Exclude<ReportPeriod, "range">,
  { previous: string; next: string }
> = {
  month: { previous: "Mes anterior", next: "Mes siguiente" },
  quarter: { previous: "Trimestre anterior", next: "Trimestre siguiente" },
  year: { previous: "Año anterior", next: "Año siguiente" }
}

function toDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

interface ReportPeriodPickerProps {
  params: ReportParams
  /** Ruta de la página que usa el selector (Reportes o Flujo de caja) */
  path: string
}

export function ReportPeriodPicker({ params, path }: ReportPeriodPickerProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function navigate(query: ReportQuery) {
    startTransition(() => {
      router.replace(`${path}?${buildReportQuery(query)}` as Route, {
        scroll: false
      })
    })
  }

  // Al cambiar de tipo se abre el periodo actual; el rango arranca con las
  // fechas del periodo que se estaba viendo
  function changePeriod(period: ReportPeriod) {
    if (period === "range") {
      navigate({ period, from: params.from, to: params.to, type: params.type })
    } else {
      navigate({ period, value: currentPeriodValue(period), type: params.type })
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 transition-opacity sm:flex-row sm:items-center",
        pending && "opacity-60"
      )}
    >
      <Select
        value={params.period}
        onValueChange={(value) => changePeriod(value as ReportPeriod)}
      >
        <SelectTrigger
          className="sm:w-36"
          aria-label="Tipo de periodo"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <SelectItem
              key={value}
              value={value}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {params.period === "range" ? (
        <RangeControl
          from={params.from}
          to={params.to}
          onChange={(from, to) =>
            navigate({ period: "range", from, to, type: params.type })
          }
        />
      ) : (
        <StepControl
          period={params.period}
          value={params.value ?? currentPeriodValue(params.period)}
          label={params.label}
          onChange={(value) =>
            navigate({
              period: params.period as Exclude<ReportPeriod, "range">,
              value,
              type: params.type
            })
          }
        />
      )}
    </div>
  )
}

function StepControl({
  period,
  value,
  label,
  onChange
}: {
  period: Exclude<ReportPeriod, "range">
  value: string
  label: string
  onChange: (value: string) => void
}) {
  const step = STEP_LABELS[period]
  const isCurrent = value === currentPeriodValue(period)

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={step.previous}
        onClick={() => onChange(shiftPeriodValue(period, value, -1))}
      >
        <ChevronLeft />
      </Button>
      <span
        className="min-w-36 text-center text-sm font-medium first-letter:uppercase"
        aria-live="polite"
      >
        {label}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label={step.next}
        onClick={() => onChange(shiftPeriodValue(period, value, 1))}
      >
        <ChevronRight />
      </Button>
      {!isCurrent && (
        <Button
          variant="ghost"
          onClick={() => onChange(currentPeriodValue(period))}
        >
          Hoy
        </Button>
      )}
    </div>
  )
}

function RangeControl({
  from,
  to,
  onChange
}: {
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <DateField
        label="Desde"
        value={from}
        disabled={{ after: toDate(to) }}
        onSelect={(value) => onChange(value, to)}
      />
      <span className="text-muted-foreground">–</span>
      <DateField
        label="Hasta"
        value={to}
        disabled={{ before: toDate(from) }}
        onSelect={(value) => onChange(from, value)}
      />
    </div>
  )
}

function DateField({
  label,
  value,
  disabled,
  onSelect
}: {
  label: string
  value: string
  disabled: { after: Date } | { before: Date }
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="justify-start font-normal"
          aria-label={`${label}: ${formatDate(value)}`}
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
          selected={toDate(value)}
          defaultMonth={toDate(value)}
          disabled={disabled}
          onSelect={(date) => {
            if (date) {
              onSelect(toISODate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
