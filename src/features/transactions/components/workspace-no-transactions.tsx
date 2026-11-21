import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import { NoTransactions } from "./transactions-empty"

/**
 * Estado vacío de un espacio sin movimientos, con las categorías y cuentas
 * que necesita el botón de nuevo movimiento
 */
export async function WorkspaceNoTransactions({
  workspaceId,
  workspaceType
}: {
  workspaceId: string
  workspaceType: WorkspaceType
}) {
  const [categories, accounts] = await Promise.all([
    getCategories(workspaceId),
    getAccountBalances(workspaceId)
  ])

  return (
    <NoTransactions
      workspaceId={workspaceId}
      workspaceType={workspaceType}
      categories={categories}
      accounts={accounts}
    />
  )
}

/** El mismo estado vacío mientras cargan categorías y cuentas */
export function WorkspaceNoTransactionsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-card px-6 py-12 shadow-(--surface-shadow)"
    >
      <Skeleton className="size-12 rounded-2xl" />
      <div className="flex w-full max-w-sm flex-col items-center gap-1">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-48 rounded-4xl" />
        <Skeleton className="h-11 w-28 rounded-4xl" />
      </div>
    </div>
  )
}
