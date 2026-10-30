"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { formatCurrency } from "@/libs/format"
import { debtStatusLabel } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import { ToneBadge } from "./debt-indicators"
import { DebtSheet } from "./debt-sheet"
import { useDebtAction } from "./use-debt-action"

export interface InactiveDebtsProps {
  /** Deudas pagadas y archivadas */
  debts: Debt[]
  /** Pagos y ajustes por id de deuda */
  entries: Record<string, DebtEntry[]>
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  /** Título de la sección. Cuentas por cobrar: "Cobradas y archivadas" */
  title?: string
}

/** Sección plegable "Pagadas y archivadas", cerrada por defecto */
export function InactiveDebts({
  debts,
  entries,
  today,
  currency,
  title = "Pagadas y archivadas"
}: InactiveDebtsProps) {
  return (
    <Collapsible className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group w-fit"
        >
          <ChevronDown
            data-icon="inline-start"
            className="transition-transform group-data-[state=closed]:-rotate-90"
          />
          {title} ({debts.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-xl border">
          {debts.map((debt) => (
            <InactiveDebtRow
              key={debt.id}
              debt={debt}
              entries={entries[debt.id] ?? []}
              today={today}
              currency={currency}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function InactiveDebtRow({
  debt,
  entries,
  today,
  currency
}: {
  debt: Debt
  entries: DebtEntry[]
  today: string
  currency: string
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { pending, run } = useDebtAction(debt)
  const status = debtStatusLabel(debt)

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      {/* Abre el Sheet de solo lectura */}
      <button
        type="button"
        className="-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => setDetailOpen(true)}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{debt.name}</span>
          {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          Saldo {formatCurrency(debt.balance, currency)}
        </span>
      </button>
      <DebtSheet
        debt={debt}
        entries={entries}
        today={today}
        currency={currency}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run("reactivate")}
      >
        Reactivar
      </Button>
    </li>
  )
}
