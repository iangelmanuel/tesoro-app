import { TONE_BADGE_CLASSES } from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"

/** "Activo" o "Pausado" de un gasto o ingreso fijo */
export function ActiveStatusBadge({ active }: { active: boolean }) {
  return (
    <ToneBadge
      className={
        active ? TONE_BADGE_CLASSES.success : TONE_BADGE_CLASSES.neutral
      }
    >
      {active ? "Activo" : "Pausado"}
    </ToneBadge>
  )
}
