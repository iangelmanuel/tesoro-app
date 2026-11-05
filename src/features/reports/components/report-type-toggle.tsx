"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { ToggleButton, ToggleButtonGroup, cn } from "@heroui/react"
import type { TransactionType } from "@/features/transactions/filters"
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

  function changeType(keys: Set<React.Key>) {
    const [value] = [...keys]
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
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[params.type]}
      onSelectionChange={changeType}
      size="sm"
      aria-busy={pending}
      data-tour="reports-type"
      className={cn(
        "transition-opacity duration-150 motion-reduce:transition-none",
        pending && "opacity-60"
      )}
      aria-label="Tipo de movimiento"
    >
      <ToggleButton id="expense">{labels.expense}</ToggleButton>
      <ToggleButton id="income">{labels.income}</ToggleButton>
    </ToggleButtonGroup>
  )
}
