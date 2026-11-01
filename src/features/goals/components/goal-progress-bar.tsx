import { Chip, cn } from "@heroui/react"
import {
  TONE_BADGE_CLASSES as TONE_BADGE,
  TONE_BAR_CLASSES as TONE_BAR
} from "@/components/dashboard/tone"
import { GOAL_STATUS_LABELS, type GoalStatus } from "../progress"

// Sin estado (activa sin fecha) la barra usa el color primario
export const GOAL_BAR_CLASSES: Record<GoalStatus, string> = {
  completed: TONE_BAR.success,
  on_track: TONE_BAR.success,
  at_risk: TONE_BAR.warning,
  archived: TONE_BAR.neutral
}

export const GOAL_BADGE_CLASSES: Record<GoalStatus, string> = {
  completed: TONE_BADGE.success,
  on_track: TONE_BADGE.success,
  at_risk: TONE_BADGE.warning,
  archived: TONE_BADGE.neutral
}

/** Etiqueta del estado. Activa sin fecha: sin etiqueta. */
export function GoalStatusBadge({ status }: { status: GoalStatus | null }) {
  if (status === null) {
    return null
  }
  return (
    <Chip
      size="sm"
      className={GOAL_BADGE_CLASSES[status]}
      color="accent"
      variant="primary"
    >
      {GOAL_STATUS_LABELS[status]}
    </Chip>
  )
}

interface GoalProgressBarProps {
  /** Progreso entero; puede pasar de 100 */
  percent: number
  status: GoalStatus | null
  /** Nombre accesible de la barra ("Mercado: 85 %") */
  label?: string
  className?: string
}

/** Barra coloreada por estado, con tope visual en 100 % */
export function GoalProgressBar({
  percent,
  status,
  label,
  className
}: GoalProgressBarProps) {
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
          status ? GOAL_BAR_CLASSES[status] : "bg-accent"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
