import { Suspense } from "react"
import { ArrowLeftRight, Plus, Wallet } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import { AccountsGrid } from "@/features/accounts/components/accounts-grid"
import { ArchivedAccounts } from "@/features/accounts/components/archived-accounts"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
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
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
        <p className="text-sm text-muted-foreground">
          Cuánto tienes en efectivo, en el banco y en tus billeteras.
        </p>
      </header>
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
          description="Crea una cuenta o restaura una de las archivadas para ver cuánto tienes en cada una."
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
