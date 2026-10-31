import { Suspense } from "react"
import { getAccountBalances } from "@/features/accounts/queries"
import { getCategories } from "@/features/categories/queries"
import {
  getBusinessWorkspaces,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import {
  QuickAddTransactionButton,
  type QuickAddWorkspace
} from "./quick-add-transaction-button"

// Lee la sesión: va dentro de un Suspense por cacheComponents. El layout no
// conoce la ruta en el servidor, así que carga Personal y las empresas que
// aceptan escrituras, y el botón client elige el espacio activo por la ruta.
async function QuickAddTransactionLoader() {
  const [personal, businesses] = await Promise.all([
    getPersonalWorkspace(),
    getBusinessWorkspaces()
  ])
  const targets = [
    { id: personal.id, type: "personal" as const },
    ...businesses
      .filter((business) => business.deletionRequestedAt === null)
      .map((business) => ({ id: business.id, type: business.type }))
  ]

  const workspaces: QuickAddWorkspace[] = await Promise.all(
    targets.map(async (workspace) => {
      const [categories, accounts] = await Promise.all([
        getCategories(workspace.id),
        getAccountBalances(workspace.id)
      ])
      return { ...workspace, categories, accounts }
    })
  )

  return <QuickAddTransactionButton workspaces={workspaces} />
}

export function QuickAddTransaction() {
  return (
    <Suspense fallback={null}>
      <QuickAddTransactionLoader />
    </Suspense>
  )
}
