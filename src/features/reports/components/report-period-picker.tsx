"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button, ListBox, Select, cn } from "@heroui/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CONTROL_BUTTON, CONTROL_SURFACE } from "@/components/dashboard/surface"
import { DatePickerField } from "@/components/forms/date-picker-field"
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
      aria-busy={pending}
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none",
        pending && "opacity-60"
      )}
    >
      <Select
        aria-label="Periodo"
        value={params.period}
        onChange={(value) => value && changePeriod(value as ReportPeriod)}
        className="w-auto"
      >
        <Select.Trigger
          className={cn(
            "min-h-8 gap-1.5 rounded-3xl py-1 text-sm",
            CONTROL_BUTTON
          )}
        >
          <span className="text-muted">Periodo:</span>
          <Select.Value className="font-medium" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <ListBox.Item
                key={value}
                id={value}
                textValue={label}
              >
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
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
    // Mismo control que el mes de Movimientos: flechas y el periodo como
    // texto en una pill
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-3xl p-0.5",
          CONTROL_SURFACE
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={step.previous}
          onPress={() => onChange(shiftPeriodValue(period, value, -1))}
        >
          <ChevronLeft />
        </Button>
        <span
          className="min-w-32 px-1 text-center text-sm font-medium first-letter:uppercase"
          aria-live="polite"
        >
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={step.next}
          onPress={() => onChange(shiftPeriodValue(period, value, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => onChange(currentPeriodValue(period))}
        >
          Hoy
        </Button>
      )}
    </div>
  )
}

// Cada fecha navega al elegirla; "Desde" no pasa de "Hasta" ni al revés
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
    // Envuelve a 375 px en vez de desbordar
    <div className="flex flex-wrap items-end gap-2">
      <DatePickerField
        name="from"
        label="Desde"
        value={from}
        maxValue={to}
        onChange={(value) => value && onChange(value, to)}
      />
      <DatePickerField
        name="to"
        label="Hasta"
        value={to}
        minValue={from}
        onChange={(value) => value && onChange(from, value)}
      />
    </div>
  )
}
