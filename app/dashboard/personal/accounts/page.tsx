import { Suspense } from "react"
import { Button, Skeleton } from "@heroui/react"
import { Plus, Wallet } from "lucide-react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { AccountDialog } from "@/features/accounts/components/account-dialog"
import { AccountsGrid } from "@/features/accounts/components/accounts-grid"
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
    <>
      <Skeleton className="h-9 w-40 rounded-3xl" />
      <CardSkeleton className="h-24" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton className="h-44" />
        <CardSkeleton className="h-44" />
        <CardSkeleton className="h-44" />
      </div>
    </>
  )
}
