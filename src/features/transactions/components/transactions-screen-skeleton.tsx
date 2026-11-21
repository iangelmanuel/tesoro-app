import { Skeleton } from "@/components/ui/skeleton"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { TransactionsFiltersSkeleton } from "./transactions-filters"
import { TransactionsTableSkeleton } from "./transactions-table"
import { TransactionsTotalsSkeleton } from "./transactions-totals"

/**
 * Pantalla de Movimientos mientras carga: filtros, totales y tabla, cada
 * uno con su propio skeleton. La usan el Suspense de la página y su
 * loading.tsx. Empresa lleva además el botón "Nuevo movimiento" arriba
 */
export function TransactionsScreenSkeleton({
  workspaceType = "personal",
  createButton = false
}: {
  workspaceType?: WorkspaceType
  /** Reserva el botón "Nuevo movimiento" de la página */
  createButton?: boolean
}) {
  return (
    <>
      {createButton && <Skeleton className="h-11 w-48 rounded-4xl" />}
      <div className="flex flex-wrap items-start gap-2">
        <TransactionsFiltersSkeleton />
      </div>
      <TransactionsTotalsSkeleton caption />
      <TransactionsTableSkeleton workspaceType={workspaceType} />
    </>
  )
}
