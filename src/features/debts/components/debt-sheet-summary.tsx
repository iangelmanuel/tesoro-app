"use client"

import { Amount } from "@/components/dashboard/data/amount"
import { HelpHint } from "@/components/dashboard/feedback/help-hint"
import { formatDayMonth } from "@/libs/format"
import {
  cardMonthlyPayment,
  installmentsShare,
  nextFeeDate
} from "../card-cycle"
import type { Debt, DebtEntry } from "../queries"
import { collectedInYear } from "../receivable-schedule"

/** Cobro mensual indefinido: lo cobrado en el año en curso (SPEC 28) */
export function DebtSheetCollectedThisYear({
  entries,
  today,
  currency
}: {
  entries: DebtEntry[]
  today: string
  currency: string
}) {
  const collected = collectedInYear(
    entries.filter((entry) => entry.kind === "payment"),
    today
  )

  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      Cobrado en {today.slice(0, 4)}{" "}
      <span className="font-medium text-foreground">
        <Amount
          value={collected}
          currency={currency}
        />
      </span>
    </p>
  )
}

/**
 * "Pago del mes: $ 200.000 · $ 200.000 de compras a cuotas", solo en
 * tarjetas con cuotas en el ciclo (SPEC 42)
 */
export function DebtSheetInstallmentsDue({
  debt,
  currency
}: {
  debt: Debt
  currency: string
}) {
  const share = installmentsShare(debt)
  const payment = cardMonthlyPayment(debt)

  if (share === null || payment === null) {
    return null
  }

  return (
    <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground tabular-nums">
      Pago del mes:{" "}
      <span className="font-medium text-foreground">
        <Amount
          value={payment}
          currency={currency}
        />
      </span>{" "}
      ·{" "}
      <Amount
        value={share}
        currency={currency}
      />{" "}
      de compras a cuotas
      <HelpHint topic="cardInstallments" />
    </p>
  )
}

/** "Próxima cuota: 5 de diciembre · $ 22.000", solo en tarjetas con cuota */
export function DebtSheetNextFee({
  debt,
  today,
  currency
}: {
  debt: Debt
  today: string
  currency: string
}) {
  const dueOn = nextFeeDate(debt, today)

  if (dueOn === null || debt.fee_amount === null) {
    return null
  }

  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      Próxima cuota: {formatDayMonth(dueOn)} ·{" "}
      <span className="font-medium text-foreground">
        <Amount
          value={debt.fee_amount}
          currency={currency}
        />
      </span>
    </p>
  )
}
