import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import type { OccurrenceTone } from "@/features/recurring-expenses/occurrences"
import {
  PAYMENT_STATUS,
  type PaymentStatus,
  UTILIZATION_LEVELS,
  utilizationLevel
} from "../calculations"

const TONE_BADGE_CLASSES: Record<OccurrenceTone, string> = {
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground"
}

const TONE_BAR_CLASSES: Record<OccurrenceTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  neutral: "bg-muted-foreground"
}

export function ToneBadge({
  tone,
  children
}: {
  tone: OccurrenceTone
  children: React.ReactNode
}) {
  return <Badge className={TONE_BADGE_CLASSES[tone]}>{children}</Badge>
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
  className?: string
}

/** Barra de utilización o de avance, con tope visual en 100 % */
export function DebtBar({ percent, tone, className }: DebtBarProps) {
  const width = Math.min(percent, 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className={cn(
          "h-full transition-all",
          tone ? TONE_BAR_CLASSES[tone] : "bg-primary"
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
