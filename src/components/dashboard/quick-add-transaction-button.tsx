"use client"

import { useParams, usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import type { AccountOption } from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import type { WorkspaceType } from "@/features/workspaces/queries"

/** Espacio donde el registro rápido puede crear movimientos */
export interface QuickAddWorkspace {
  id: string
  type: WorkspaceType
  categories: Category[]
  accounts: AccountOption[]
}

// En /dashboard/personal/* registra en Personal y en
// /dashboard/business/[id]/* en esa empresa. En otras rutas no se muestra
export function QuickAddTransactionButton({
  workspaces
}: {
  workspaces: QuickAddWorkspace[]
}) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const personal = SITE.routes.dashboardPersonal

  const workspace =
    pathname === personal || pathname.startsWith(`${personal}/`)
      ? workspaces.find((option) => option.type === "personal")
      : pathname.startsWith(`${SITE.routes.dashboardBusiness}/`)
        ? workspaces.find(
            (option) => option.type === "business" && option.id === params.id
          )
        : undefined

  if (!workspace) {
    return null
  }

  return (
    <TransactionDialog
      // Al cambiar de espacio el diálogo empieza de cero
      key={workspace.id}
      workspaceId={workspace.id}
      workspaceType={workspace.type}
      categories={workspace.categories}
      accounts={workspace.accounts}
      trigger={
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span className="hidden sm:inline">Nuevo movimiento</span>
          <span className="sr-only sm:hidden">Nuevo movimiento</span>
        </Button>
      }
    />
  )
}
