import { Suspense } from "react"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { QuickAddTransactionButton } from "./quick-add-transaction-button"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que el botón client decide si se muestra.
async function QuickAddTransactionLoader() {
  const workspace = await getPersonalWorkspace()
  const [categories, accounts] = await Promise.all([
    getCategories(workspace.id),
    getAccountBalances(workspace.id)
  ])

  return (
    <QuickAddTransactionButton
      workspaceId={workspace.id}
      categories={categories}
      accounts={accounts}
    />
  )
}

export function QuickAddTransaction() {
  return (
    <Suspense fallback={null}>
      <QuickAddTransactionLoader />
    </Suspense>
  )
}
