"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { TransactionType } from "@/features/transactions/filters"
import {
  REPORTS_PATH,
  type ReportParams,
  buildReportQuery,
  reportQueryFromParams
} from "../period"

interface ReportTypeToggleProps {
  params: ReportParams
}

// Cambia dona, top y tabla entre gastos e ingresos. La tendencia no depende
// del tipo.
export function ReportTypeToggle({ params }: ReportTypeToggleProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function changeType(value: string) {
    // Radix entrega "" al pulsar el ítem activo: se ignora
    if (!value || value === params.type) return

    const query = reportQueryFromParams(params, {
      type: value as TransactionType
    })
    startTransition(() => {
      router.replace(`${REPORTS_PATH}?${buildReportQuery(query)}` as Route, {
        scroll: false
      })
    })
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={params.type}
      onValueChange={changeType}
      className={cn("transition-opacity", pending && "opacity-60")}
      aria-label="Tipo de movimiento"
    >
      <ToggleGroupItem value="expense">Gastos</ToggleGroupItem>
      <ToggleGroupItem value="income">Ingresos</ToggleGroupItem>
    </ToggleGroup>
  )
}
