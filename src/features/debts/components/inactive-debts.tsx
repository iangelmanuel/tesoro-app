"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible"
import { formatCurrency } from "@/libs/format"
import { debtStatusLabel } from "../calculations"
import type { Debt } from "../queries"
import { ToneBadge } from "./debt-indicators"
import { useDebtAction } from "./use-debt-action"

interface InactiveDebtsProps {
  /** Deudas pagadas y archivadas */
  debts: Debt[]
  currency: string
}

/** Sección plegable "Pagadas y archivadas", cerrada por defecto */
export function InactiveDebts({ debts, currency }: InactiveDebtsProps) {
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
          Pagadas y archivadas ({debts.length})
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y rounded-xl border">
          {debts.map((debt) => (
            <InactiveDebtRow
              key={debt.id}
              debt={debt}
              currency={currency}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function InactiveDebtRow({ debt, currency }: { debt: Debt; currency: string }) {
  const { pending, run } = useDebtAction(debt)
  const status = debtStatusLabel(debt)

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{debt.name}</span>
          {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          Saldo {formatCurrency(debt.balance, currency)}
        </span>
      </div>
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
