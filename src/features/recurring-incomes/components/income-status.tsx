import { Amount } from "@/components/dashboard/amount"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
import { ToneBadge } from "@/components/dashboard/tone-badge"
import {
  INCOME_OCCURRENCE_STATUS,
  type IncomeOccurrenceStatus,
  type IncomeOccurrenceTone
} from "../occurrences"

// Piezas de estado de una ocurrencia: las usan la lista del mes y el Sheet

const TONE_CLASSES: Record<IncomeOccurrenceTone, string> = {
  success: TONE_BADGE.success,
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  neutral: TONE_BADGE.neutral
}

export function IncomeStatusBadge({
  status
}: {
  status: IncomeOccurrenceStatus
}) {
  const { label, tone } = INCOME_OCCURRENCE_STATUS[status]
  return <ToneBadge className={TONE_CLASSES[tone]}>{label}</ToneBadge>
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
