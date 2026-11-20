"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { cn } from "@/libs/cn"
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
      <h2 className="w-fit">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group/inactive px-3"
            />
          }
          data-tour="debts-inactive"
        >
          <ChevronRight
            aria-hidden
            className="group-data-panel-open/inactive:rotate-90 motion-safe:transition-transform"
          />
          {title} ({debts.length})
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <ul className={SURFACE_LIST}>
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
    <li className={cn(SURFACE_ROW, "flex flex-wrap items-center gap-3")}>
      {/* Abre el Sheet de solo lectura */}
      <button
        type="button"
        className="-m-1 flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-2xl p-1 text-left transition-colors outline-none hover:bg-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setDetailOpen(true)}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{debt.name}</span>
          {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          Saldo{" "}
          <Amount
            value={debt.balance}
            currency={currency}
          />
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
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run("reactivate")}
      >
        Reactivar
      </Button>
    </li>
  )
}
