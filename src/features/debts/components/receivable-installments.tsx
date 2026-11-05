"use client"

import { useState } from "react"
import { Button, cn } from "@heroui/react"
import { Check } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { formatShortDate } from "@/libs/format"
import { formatMonthYear } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import {
  INSTALLMENT_STATUS,
  type Installment,
  buildInstallments
} from "../receivable-schedule"
import { ToneBadge } from "./debt-indicators"

/** Filas visibles antes de "Ver más" (cuentas indefinidas antiguas) */
const VISIBLE_INSTALLMENTS = 12

interface ReceivableInstallmentsProps {
  debt: Pick<Debt, "starts_on" | "due_day" | "term_months" | "installment">
  entries: DebtEntry[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  /** Cobradas o archivadas: sin "Marcar pagada" */
  readOnly?: boolean
  /** Abre el cobro de una cuota pendiente o atrasada */
  onCollect: (installment: Installment) => void
}

/**
 * Cuotas de una cuenta por cobrar mensual (SPEC 28), la más reciente
 * primero: mes, fecha de pago, estado y, si se cobró, fecha y monto. Muestra
 * las últimas 12 y un "Ver más".
 */
export function ReceivableInstallments({
  debt,
  entries,
  today,
  currency,
  readOnly,
  onCollect
}: ReceivableInstallmentsProps) {
  const [showAll, setShowAll] = useState(false)

  if (debt.starts_on === null || debt.due_day === null) {
    return null
  }

  const installments = buildInstallments(
    {
      starts_on: debt.starts_on,
      due_day: debt.due_day,
      term_months: debt.term_months
    },
    entries
      .filter((entry) => entry.kind === "payment")
      .map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        occurred_on: entry.occurred_on,
        period_on: entry.period_on
      })),
    today
  ).reverse()

  const visible = showAll
    ? installments
    : installments.slice(0, VISIBLE_INSTALLMENTS)
  const hiddenCount = installments.length - visible.length

  return (
    <div className="flex flex-col gap-2">
      <ul className={CARD_LIST}>
        {visible.map((installment) => (
          <InstallmentRow
            key={installment.period_on}
            installment={installment}
            monthlyAmount={debt.installment}
            currency={currency}
            readOnly={readOnly}
            onCollect={onCollect}
          />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start max-md:min-h-11"
          onPress={() => setShowAll(true)}
        >
          Ver más ({hiddenCount})
        </Button>
      )}
    </div>
  )
}

function InstallmentRow({
  installment,
  monthlyAmount,
  currency,
  readOnly,
  onCollect
}: {
  installment: Installment
  monthlyAmount: number | null
  currency: string
  readOnly?: boolean
  onCollect: (installment: Installment) => void
}) {
  const { label, tone } = INSTALLMENT_STATUS[installment.status]
  const { entry } = installment
  const month = formatMonthYear(installment.period_on.slice(0, 7))

  return (
    <li className={cn(CARD_ROW, "flex items-center justify-between gap-3")}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium first-letter:uppercase">
            {month}
          </span>
          <ToneBadge tone={tone}>{label}</ToneBadge>
        </div>
        <p className="text-xs text-muted tabular-nums">
          {entry
            ? `Pagada el ${formatShortDate(entry.occurred_on)}`
            : `Vence el ${formatShortDate(installment.due_on)}`}
        </p>
      </div>

      {entry ? (
        // Monto cobrado: puede ser distinto al mensual
        <span
          className={cn(
            "shrink-0 text-sm font-medium",
            entry.amount !== monthlyAmount && TONE_TEXT_CLASSES.warning
          )}
        >
          <Amount
            value={entry.amount}
            currency={currency}
          />
        </span>
      ) : (
        !readOnly && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 max-md:min-h-11"
            aria-label={`Marcar pagada la cuota de ${month}`}
            onPress={() => onCollect(installment)}
          >
            <Check />
            Marcar pagada
          </Button>
        )
      )}
    </li>
  )
}
