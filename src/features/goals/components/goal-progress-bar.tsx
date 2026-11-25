import {
  TONE_BAR_CLASSES,
  type Tone
} from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { cn } from "@/libs/cn"
import { GOAL_STATUS_LABELS, type GoalStatus } from "../progress"

/** Tono de cada estado; sin estado (activa sin fecha) la barra usa el primario */
const GOAL_TONES: Record<GoalStatus, Tone> = {
  completed: "success",
  on_track: "success",
  at_risk: "warning",
  archived: "neutral"
}

/** Etiqueta del estado. Activa sin fecha: sin etiqueta. */
export function GoalStatusBadge({ status }: { status: GoalStatus | null }) {
  if (status === null) {
    return null
  }
  return (
    <ToneBadge tone={GOAL_TONES[status]}>
      {GOAL_STATUS_LABELS[status]}
    </ToneBadge>
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
        "flex h-2 w-full overflow-hidden rounded-full bg-subtle",
        className
      )}
    >
      <div
        className={cn(
          "h-full transition-all motion-reduce:transition-none",
          status ? TONE_BAR_CLASSES[GOAL_TONES[status]] : "bg-primary"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
