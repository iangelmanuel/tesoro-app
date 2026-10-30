import { Suspense } from "react"
import { getCategories } from "@/features/categories/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { QuickAddTransactionButton } from "./quick-add-transaction-button"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que el botón client decide si se muestra.
async function QuickAddTransactionLoader() {
  const workspace = await getPersonalWorkspace()
  const categories = await getCategories(workspace.id)

  return <QuickAddTransactionButton categories={categories} />
}

export function QuickAddTransaction() {
  return (
    <Suspense fallback={null}>
      <QuickAddTransactionLoader />
    </Suspense>
  )
}
