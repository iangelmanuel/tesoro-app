import { Chip, cn } from "@heroui/react"
import {
  TONE_BADGE_CLASSES as TONE_BADGE,
  TONE_BAR_CLASSES as TONE_BAR
} from "@/components/dashboard/tone"
import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import {
  PAYMENT_STATUS,
  type PaymentStatus,
  UTILIZATION_LEVELS,
  utilizationLevel
} from "../calculations"

const TONE_BADGE_CLASSES: Record<OccurrenceTone, string> = {
  success: TONE_BADGE.success,
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  neutral: TONE_BADGE.neutral
}

const TONE_BAR_CLASSES: Record<OccurrenceTone, string> = {
  success: TONE_BAR.success,
  danger: TONE_BAR.danger,
  warning: TONE_BAR.warning,
  neutral: TONE_BAR.neutral
}

export function ToneBadge({
  tone,
  children
}: {
  tone: OccurrenceTone
  children: React.ReactNode
}) {
  return (
    <Chip
      size="sm"
      className={TONE_BADGE_CLASSES[tone]}
      color="accent"
      variant="primary"
    >
      {children}
    </Chip>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, tone } = PAYMENT_STATUS[status]
  return <ToneBadge tone={tone}>{label}</ToneBadge>
}

/** "Saludable", "Moderada" o "Alta" según el porcentaje de utilización */
export function UtilizationBadge({ percent }: { percent: number }) {
  const { label, tone } = UTILIZATION_LEVELS[utilizationLevel(percent)]
  return <ToneBadge tone={tone}>{label}</ToneBadge>
}

interface DebtBarProps {
  /** Porcentaje entero; puede pasar de 100 */
  percent: number
  /** Sin tono, la barra usa el color primario */
  tone?: OccurrenceTone
  /** Nombre accesible de la barra ("Mercado: 85 %") */
  label?: string
  className?: string
}

/** Barra de utilización o de avance, con tope visual en 100 % */
export function DebtBar({ percent, tone, label, className }: DebtBarProps) {
  const width = Math.min(percent, 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-label={label}
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-full bg-default",
        className
      )}
    >
      <div
        className={cn(
          "h-full transition-all motion-reduce:transition-none",
          tone ? TONE_BAR_CLASSES[tone] : "bg-accent"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

/** Barra de utilización coloreada por nivel */
export function UtilizationBar({
  percent,
  className
}: {
  percent: number
  className?: string
}) {
  return (
    <DebtBar
      percent={percent}
      tone={UTILIZATION_LEVELS[utilizationLevel(percent)].tone}
      className={className}
    />
  )
}
