import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { OCCURRENCE_STATUS, type OccurrenceStatus } from "../occurrences"

/** Pagado, Atrasado, Hoy o Próximo, con su tono */
export function OccurrenceStatusBadge({
  status
}: {
  status: OccurrenceStatus
}) {
  const { label, tone } = OCCURRENCE_STATUS[status]
  return <ToneBadge tone={tone}>{label}</ToneBadge>
}
