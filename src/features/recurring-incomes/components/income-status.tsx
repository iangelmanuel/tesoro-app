import { Chip } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
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
  neutral: "bg-default text-muted"
}

export function IncomeStatusBadge({
  status
}: {
  status: IncomeOccurrenceStatus
}) {
  const { label, tone } = INCOME_OCCURRENCE_STATUS[status]
  return (
    <Chip
      size="sm"
      className={TONE_CLASSES[tone]}
      color="accent"
      variant="primary"
    >
      {label}
    </Chip>
  )
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
