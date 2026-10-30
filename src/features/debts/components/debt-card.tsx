"use client"

import { useState } from "react"
import { Archive, CircleCheck, EllipsisVertical, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { formatPercent } from "@/features/budgets/progress"
import { formatCurrency, formatDate } from "@/libs/format"
import {
  debtProjection,
  formatMonthYear,
  formatRate,
  hasZeroBalance,
  nextPayment,
  paidPercent,
  utilizationPercent
} from "../calculations"
import type { Debt } from "../queries"
import { ArchiveDebtDialog } from "./archive-debt-dialog"
import { DebtDialog } from "./debt-dialog"
import {
  DebtBar,
  PaymentStatusBadge,
  ToneBadge,
  UtilizationBadge,
  UtilizationBar
} from "./debt-indicators"
import { useDebtAction } from "./use-debt-action"

const KIND_LABELS = { credit_card: "Tarjeta", loan: "Préstamo" } as const

interface DebtCardProps {
  /** Tarjeta o préstamo activo */
  debt: Debt
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
}

export function DebtCard({ debt, today, currency }: DebtCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { pending, run } = useDebtAction(debt)
  const zeroBalance = hasZeroBalance(debt)

  function archive() {
    if (debt.balance > 0) {
      setConfirmArchive(true)
    } else {
      run("archive")
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{debt.name}</span>
            <span className="text-xs text-muted-foreground">
              {debt.kind === "loan"
                ? KIND_LABELS.loan
                : KIND_LABELS.credit_card}
              {debt.counterparty && ` · ${debt.counterparty}`}
            </span>
          </div>
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(debt.balance, currency)}
          </span>
          <span className="text-sm text-muted-foreground">
            {debt.interest_rate !== null && debt.rate_type !== null
              ? formatRate(debt.interest_rate, debt.rate_type)
              : "Sin tasa"}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de ${debt.name}`}
              disabled={pending}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              Editar
            </DropdownMenuItem>
            {zeroBalance && (
              <DropdownMenuItem onSelect={() => run("markPaid")}>
                <CircleCheck />
                Marcar como pagada
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={archive}>
              <Archive />
              Archivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DebtDialog
          debt={debt}
          open={editing}
          onOpenChange={setEditing}
        />
        <ArchiveDebtDialog
          name={debt.name}
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          onConfirm={() => run("archive")}
        />
      </div>

      <DebtProgress debt={debt} />

      {zeroBalance ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Saldo en cero
          </p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run("markPaid")}
          >
            Marcar como pagada
          </Button>
        </div>
      ) : (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <NextDue
            debt={debt}
            today={today}
            currency={currency}
          />
          <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
            <dt className="text-muted-foreground">Proyección</dt>
            <dd className="font-medium">
              <ProjectionSummary debt={debt} />
            </dd>
          </div>
        </dl>
      )}
    </li>
  )
}

/** Utilización (tarjeta) o % pagado (préstamo con monto original) */
export function DebtProgress({ debt }: { debt: Debt }) {
  if (debt.kind === "credit_card" && debt.credit_limit !== null) {
    const percent = utilizationPercent(debt.balance, debt.credit_limit)

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <UtilizationBar percent={percent} />
          <span className="text-sm font-medium tabular-nums">
            {formatPercent(percent)}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Utilización del cupo
          <UtilizationBadge percent={percent} />
        </p>
      </div>
    )
  }

  const percent = paidPercent(debt)
  if (percent === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <DebtBar percent={percent} />
        <span className="text-sm font-medium tabular-nums">
          {formatPercent(percent)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Pagado del monto original</p>
    </div>
  )
}

function NextDue({
  debt,
  today,
  currency
}: {
  debt: Debt
  today: string
  currency: string
}) {
  const payment = nextPayment(debt, today)

  if (payment === null) {
    return null
  }

  return (
    <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
      <dt className="text-muted-foreground">Próximo pago</dt>
      <dd className="flex flex-wrap items-center gap-2 font-medium">
        {formatDate(payment.dueOn)}
        {payment.amount !== null && (
          <span className="tabular-nums">
            · {formatCurrency(payment.amount, currency)}
          </span>
        )}
        {payment.status && <PaymentStatusBadge status={payment.status} />}
      </dd>
    </div>
  )
}

/** Proyección corta: "Terminas en octubre de 2027" o el aviso que aplique */
export function ProjectionSummary({ debt }: { debt: Debt }) {
  const projection = debtProjection(debt)

  if (projection === null) {
    return null
  }

  switch (projection.kind) {
    case "needs_min_payment":
      return (
        <span className="text-muted-foreground">
          Agrega el pago mínimo para ver la proyección
        </span>
      )
    case "no_progress":
      return <ToneBadge tone="danger">Con este pago la deuda no baja</ToneBadge>
    case "too_long":
      return <ToneBadge tone="warning">Más de 50 años</ToneBadge>
    case "ok":
      return (
        <span className="flex flex-col">
          Terminas en {formatMonthYear(projection.payoffMonth)}
          {projection.withoutRate && (
            <span className="text-xs font-normal text-muted-foreground">
              Sin tasa, la proyección no incluye intereses
            </span>
          )}
        </span>
      )
  }
}
