"use client"

import { useState } from "react"
import { Button, Disclosure } from "@heroui/react"
import { SURFACE_LIST, SURFACE_ROW } from "@/components/dashboard/surface"
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
    <Disclosure className="flex flex-col gap-3">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default">
          <Disclosure.Indicator />
          {title} ({debts.length})
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
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
      </Disclosure.Content>
    </Disclosure>
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
    <li className={`flex flex-wrap items-center gap-3 ${SURFACE_ROW}`}>
      {/* Abre el Sheet de solo lectura */}
      <button
        type="button"
        className="-m-1 flex min-w-0 flex-1 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-default/50 focus-visible:ring-[3px] focus-visible:ring-focus/50 focus-visible:outline-none"
        onClick={() => setDetailOpen(true)}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{debt.name}</span>
          {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
        </span>
        <span className="text-sm text-muted tabular-nums">
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
        isDisabled={pending}
        onPress={() => run("reactivate")}
      >
        Reactivar
      </Button>
    </li>
  )
}
