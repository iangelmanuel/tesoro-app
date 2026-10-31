"use client"

import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"
import type { AccountOption } from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"

// Solo en el espacio Personal: Empresa aún no tiene movimientos
export function QuickAddTransactionButton({
  workspaceId,
  categories,
  accounts
}: {
  workspaceId: string
  categories: Category[]
  accounts: AccountOption[]
}) {
  const pathname = usePathname()
  const personal = SITE.routes.dashboardPersonal

  if (pathname !== personal && !pathname.startsWith(`${personal}/`)) {
    return null
  }

  return (
    <TransactionDialog
      workspaceId={workspaceId}
      categories={categories}
      accounts={accounts}
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
