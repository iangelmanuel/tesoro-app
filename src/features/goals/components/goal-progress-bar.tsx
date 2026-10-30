import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { GOAL_STATUS_LABELS, type GoalStatus } from "../progress"

// Sin estado (activa sin fecha) la barra usa el color primario
export const GOAL_BAR_CLASSES: Record<GoalStatus, string> = {
  completed: "bg-emerald-500",
  on_track: "bg-emerald-500",
  at_risk: "bg-amber-500",
  archived: "bg-muted-foreground"
}

export const GOAL_BADGE_CLASSES: Record<GoalStatus, string> = {
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  on_track:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  archived: "bg-muted text-muted-foreground"
}

/** Etiqueta del estado. Activa sin fecha: sin etiqueta. */
export function GoalStatusBadge({ status }: { status: GoalStatus | null }) {
  if (status === null) {
    return null
  }
  return (
    <Badge className={GOAL_BADGE_CLASSES[status]}>
      {GOAL_STATUS_LABELS[status]}
    </Badge>
  )
}

interface GoalProgressBarProps {
  /** Progreso entero; puede pasar de 100 */
  percent: number
  status: GoalStatus | null
  className?: string
}

/** Barra coloreada por estado, con tope visual en 100 % */
export function GoalProgressBar({
  percent,
  status,
  className
}: GoalProgressBarProps) {
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
          status ? GOAL_BAR_CLASSES[status] : "bg-primary"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
