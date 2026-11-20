import { Suspense } from "react"
import { Plus, Wallet } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { LoadingRegion } from "@/components/ui/skeleton"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import {
  AccountsGrid,
  AccountsScreenSkeleton
} from "@/features/accounts/components/accounts-grid"
import { ArchivedAccounts } from "@/features/accounts/components/archived-accounts"
import { ACCOUNTS_PATH } from "@/features/accounts/constants"
import { getAccountBalances } from "@/features/accounts/queries"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuentas",
  path: ACCOUNTS_PATH,
  noindex: true
})

export default function AccountsPage() {
  return (
    <section
      aria-label="Cuentas"
      className="flex flex-1 flex-col gap-6"
    >
      {/* La sesión es dinámica: va dentro de Suspense */}
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsContent />
      </Suspense>
    </section>
  )
}

async function AccountsContent() {
  const workspace = await getPersonalWorkspace()
  const accounts = await getAccountBalances(workspace.id)

  const active = accounts.filter((account) => !account.archived_at)
  const archived = accounts.filter((account) => account.archived_at)

  const createButton = (
    <AccountDialog
      workspaceId={workspace.id}
      trigger={
        <Button data-tour="accounts-create">
          <Plus />
          Nueva cuenta
        </Button>
      }
    />
  )

  return (
    <>
      {active.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No tienes cuentas activas"
          description="Crea una cuenta o restaura una de las archivadas para ver cuánto tienes en cada una."
        >
          {createButton}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">{createButton}</div>
          <AccountsGrid
            accounts={active}
            currency={workspace.currency}
          />
        </>
      )}

      {archived.length > 0 && (
        <ArchivedAccounts
          accounts={archived}
          currency={workspace.currency}
        />
      )}
    </>
  )
}

function AccountsSkeleton() {
  return (
    <LoadingRegion
      label="Cargando cuentas…"
      className="flex flex-1 flex-col gap-6"
    >
      <AccountsScreenSkeleton />
    </LoadingRegion>
  )
}
