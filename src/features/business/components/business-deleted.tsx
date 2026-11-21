import { CalendarX } from "lucide-react"
import { EmptyState } from "@/components/dashboard/feedback/empty-state"
import { SITE } from "@/config/site"
import { deletionDate, formatDeletionDate } from "@/features/account/deletion"
import { RestoreBusinessButton } from "./restore-business-button"

interface BusinessDeletedProps {
  workspaceId: string
  name: string
  /** `workspaces.deletion_requested_at` */
  deletionRequestedAt: string
}

// Reemplaza todas las rutas de una empresa programada para borrarse
export function BusinessDeleted({
  workspaceId,
  name,
  deletionRequestedAt
}: BusinessDeletedProps) {
  const date = formatDeletionDate(
    deletionDate(deletionRequestedAt, SITE.workspaceDeletionGraceDays)
  )

  return (
    <EmptyState
      icon={CalendarX}
      title={`Esta empresa se borrará el ${date}`}
      description={`${name} y todos sus movimientos, categorías y cuentas se borrarán para siempre ese día. Hasta entonces puedes restaurarla.`}
      className="flex-1"
    >
      <RestoreBusinessButton workspaceId={workspaceId} />
    </EmptyState>
  )
}
