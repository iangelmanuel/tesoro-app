import { Amount } from "@/components/dashboard/data/amount"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import {
  INCOME_OCCURRENCE_STATUS,
  type IncomeOccurrenceStatus
} from "../occurrences"

// Piezas de estado de una ocurrencia: las usan la lista del mes y el Sheet

export function IncomeStatusBadge({
  status
}: {
  status: IncomeOccurrenceStatus
}) {
  const { label, tone } = INCOME_OCCURRENCE_STATUS[status]
  return <ToneBadge tone={tone}>{label}</ToneBadge>
}

/** "Recibió $ 20.000 de $ 50.000 · Falta $ 30.000" */
export function PartialDetail({
  received,
  expected,
  remaining,
  currency
}: {
  received: number
  expected: number
  remaining: number
  currency: string
}) {
  return (
    <span className="tabular-nums">
      Recibió{" "}
      <Amount
        value={received}
        currency={currency}
      />{" "}
      de{" "}
      <Amount
        value={expected}
        currency={currency}
      />{" "}
      · Falta{" "}
      <Amount
        value={remaining}
        currency={currency}
      />
    </span>
  )
}
