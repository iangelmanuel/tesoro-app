import { CalendarX } from "lucide-react"
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
    <section className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CalendarX className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Esta empresa se borrará el {date}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {name} y todos sus movimientos, categorías y cuentas se borrarán para
          siempre ese día. Hasta entonces puedes restaurarla.
        </p>
      </div>
      <RestoreBusinessButton workspaceId={workspaceId} />
    </section>
  )
}
