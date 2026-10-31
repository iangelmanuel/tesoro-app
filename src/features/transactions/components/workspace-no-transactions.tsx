import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
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
