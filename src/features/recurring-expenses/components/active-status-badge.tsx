import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"

/** "Activo" o "Pausado" de un gasto o ingreso fijo */
export function ActiveStatusBadge({ active }: { active: boolean }) {
  return (
    <ToneBadge tone={active ? "success" : "neutral"}>
      {active ? "Activo" : "Pausado"}
    </ToneBadge>
  )
}
