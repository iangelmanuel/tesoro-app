"use client"

import { useState } from "react"
import { Button, cn } from "@heroui/react"
import { Check, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { formatCurrency, formatShortDate } from "@/libs/format"
import { formatMonthYear } from "../calculations"
import type { Debt, DebtEntry } from "../queries"
import {
  INSTALLMENT_STATUS,
  type Installment,
  receivableInstallments
} from "../receivable-schedule"
import { ToneBadge } from "./debt-indicators"

/** Filas visibles antes de "Ver más" (cuentas indefinidas antiguas) */
const VISIBLE_INSTALLMENTS = 12

interface ReceivableInstallmentsProps {
  debt: Pick<
    Debt,
    | "starts_on"
    | "due_day"
    | "term_months"
    | "installment"
    | "installment_history"
  >
  entries: DebtEntry[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  /** Cobradas o archivadas: sin "Marcar pagada" ni "Abonar" */
  readOnly?: boolean
  /** Abre el cobro de una cuota sin cubrir */
  onCollect: (installment: Installment) => void
}

/**
 * Cuotas de una cuenta por cobrar mensual (SPEC 28 y 29), la más reciente
 * primero: mes, fecha de pago, estado y lo cobrado. Una cuota abonada en
 * parte muestra cuánto falta. Muestra las últimas 12 y un "Ver más".
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
  const installments = receivableInstallments(debt, entries, today).reverse()

  if (installments.length === 0) {
    return null
  }

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

/** Detalle bajo el mes: fecha del cobro, lo abonado o la fecha de pago */
function installmentDetail(installment: Installment, currency: string) {
  const lastEntry = installment.entries.at(-1)

  if (installment.status === "paid" && lastEntry) {
    return installment.entries.length === 1
      ? `Pagada el ${formatShortDate(lastEntry.occurred_on)}`
      : `${installment.entries.length} abonos · último el ${formatShortDate(lastEntry.occurred_on)}`
  }
  if (installment.status === "partial") {
    return `Abonó ${formatCurrency(installment.paid, currency)} de ${formatCurrency(installment.expected, currency)} · vence el ${formatShortDate(installment.due_on)}`
  }
  return `Vence el ${formatShortDate(installment.due_on)}`
}

function InstallmentRow({
  installment,
  currency,
  readOnly,
  onCollect
}: {
  installment: Installment
  currency: string
  readOnly?: boolean
  onCollect: (installment: Installment) => void
}) {
  const { label, tone } = INSTALLMENT_STATUS[installment.status]
  const month = formatMonthYear(installment.period_on.slice(0, 7))
  const isPaid = installment.status === "paid"
  const isPartial = installment.status === "partial"

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
          {installmentDetail(installment, currency)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {(isPaid || isPartial) && (
          // Cobrado si está pagada (puede pasar del valor); lo que falta si
          // está abonada
          <span
            className={cn(
              "text-sm font-medium",
              isPartial && TONE_TEXT_CLASSES.danger,
              isPaid &&
                installment.paid !== installment.expected &&
                TONE_TEXT_CLASSES.warning
            )}
          >
            {isPartial && "Falta "}
            <Amount
              value={isPartial ? installment.remaining : installment.paid}
              currency={currency}
            />
          </span>
        )}
        {!isPaid && !readOnly && (
          <Button
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            aria-label={
              isPartial
                ? `Abonar a la cuota de ${month}`
                : `Marcar pagada la cuota de ${month}`
            }
            onPress={() => onCollect(installment)}
          >
            {isPartial ? <Plus /> : <Check />}
            {isPartial ? "Abonar" : "Marcar pagada"}
          </Button>
        )}
      </div>
    </li>
  )
}
