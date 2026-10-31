import { Suspense } from "react"
import { ArrowLeftRight, Plus, Wallet } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import { AccountsGrid } from "@/features/accounts/components/accounts-grid"
import { ArchivedAccounts } from "@/features/accounts/components/archived-accounts"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { getAccountBalances } from "@/features/accounts/queries"
import { workspaceTransactionsPath } from "@/features/workspaces/paths"
import { getWorkspace } from "@/features/workspaces/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuentas",
  path: SITE.routes.dashboardBusiness,
  noindex: true
})

type BusinessAccountsPageProps = PageProps<"/dashboard/business/[id]/accounts">

export default function BusinessAccountsPage({
  params
}: BusinessAccountsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
        <p className="text-sm text-muted-foreground">
          Cuánto tiene tu empresa en efectivo, en el banco y en sus billeteras.
        </p>
      </header>
      {/* params y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsContent params={params} />
      </Suspense>
    </section>
  )
}

// El layout ya validó que la empresa es del usuario y no está marcada
async function AccountsContent({
  params
}: Pick<BusinessAccountsPageProps, "params">) {
  const { id } = await params
  const workspace = await getWorkspace(id)
  const accounts = await getAccountBalances(workspace.id)
  const transactionsPath = workspaceTransactionsPath(workspace)

  const active = accounts.filter((account) => !account.archived_at)
  const archived = accounts.filter((account) => account.archived_at)

  const createButton = (
    <AccountDialog
      workspaceId={workspace.id}
      trigger={
        <Button>
          <Plus data-icon="inline-start" />
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
          description="Crea una cuenta o restaura una de las archivadas para ver cuánto tiene tu empresa en cada una."
        >
          {createButton}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {createButton}
            {/* Un traspaso necesita al menos dos cuentas activas */}
            {active.length > 1 && (
              <TransferDialog
                workspaceId={workspace.id}
                accounts={accounts}
                trigger={
                  <Button variant="outline">
                    <ArrowLeftRight data-icon="inline-start" />
                    Traspaso
                  </Button>
                }
              />
            )}
          </div>
          <AccountsGrid
            accounts={active}
            currency={workspace.currency}
            transactionsPath={transactionsPath}
          />
        </>
      )}

      {archived.length > 0 && (
        <ArchivedAccounts
          accounts={archived}
          currency={workspace.currency}
          transactionsPath={transactionsPath}
        />
      )}
    </>
  )
}

function AccountsSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </>
  )
}
