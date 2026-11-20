import type { WorkspaceType } from "@/features/workspaces/queries"
import { TransactionsFiltersSkeleton } from "./transactions-filters"
import { TransactionsTableSkeleton } from "./transactions-table"
import { TransactionsTotalsSkeleton } from "./transactions-totals"

/**
 * Pantalla de Movimientos mientras carga: filtros, totales y tabla, cada
 * uno con su propio skeleton. La usan el Suspense de la página y su
 * loading.tsx
 */
export function TransactionsScreenSkeleton({
  workspaceType = "personal"
}: {
  workspaceType?: WorkspaceType
}) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <TransactionsFiltersSkeleton />
      </div>
      <TransactionsTotalsSkeleton caption />
      <TransactionsTableSkeleton workspaceType={workspaceType} />
    </>
  )
}
