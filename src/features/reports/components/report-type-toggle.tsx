"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  SEGMENT_ITEM_CLASS,
  SEGMENT_TRACK_CLASS
} from "@/components/forms/segmented-field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { TransactionType } from "@/features/transactions/filters"
import { cn } from "@/libs/cn"
import { REPORT_LABELS, type ReportLabels } from "../labels"
import {
  type ReportParams,
  buildReportQuery,
  reportQueryFromParams
} from "../period"

interface ReportTypeToggleProps {
  params: ReportParams
  /** Ruta de Reportes del espacio */
  path: string
  /** Textos del espacio. Por defecto, los de Personal */
  labels?: Pick<ReportLabels, "income" | "expense">
}

// Cambia dona, top y tabla entre gastos e ingresos. La tendencia no depende
// del tipo.
export function ReportTypeToggle({
  params,
  path,
  labels = REPORT_LABELS.personal
}: ReportTypeToggleProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function changeType(next: unknown[]) {
    const [value] = next
    if (!value || value === params.type) return

    const query = reportQueryFromParams(params, {
      type: value as TransactionType
    })
    startTransition(() => {
      router.replace(`${path}?${buildReportQuery(query)}` as Route, {
        scroll: false
      })
    })
  }

  return (
    <ToggleGroup
      value={[params.type]}
      onValueChange={changeType}
      spacing={1}
      aria-busy={pending}
      aria-label="Tipo de movimiento"
      data-tour="reports-type"
      className={cn(
        SEGMENT_TRACK_CLASS,
        "h-11 w-auto bg-card transition-opacity duration-150 motion-reduce:transition-none dark:bg-card",
        pending && "opacity-60"
      )}
    >
      <ToggleGroupItem
        value="expense"
        className={SEGMENT_ITEM_CLASS}
      >
        {labels.expense}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="income"
        className={SEGMENT_ITEM_CLASS}
      >
        {labels.income}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
