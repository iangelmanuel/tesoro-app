import { Suspense } from "react"
import { CreditCard, Plus } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DEBTS_PATH, compareByNextDue } from "@/features/debts/calculations"
import { DebtCard } from "@/features/debts/components/debt-card"
import { DebtDialog } from "@/features/debts/components/debt-dialog"
import { DebtTotals } from "@/features/debts/components/debt-totals"
import { DebtsTabs } from "@/features/debts/components/debts-tabs"
import { InactiveDebts } from "@/features/debts/components/inactive-debts"
import { UpcomingDebtPayments } from "@/features/debts/components/upcoming-debt-payments"
import { type Debt, getDebts } from "@/features/debts/queries"
import { parseDebtsTab } from "@/features/debts/tabs"
import {
  type PersonalWorkspace,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Deudas",
  path: DEBTS_PATH,
  noindex: true
})

type DebtsPageProps = PageProps<"/dashboard/personal/debts">

export default function DebtsPage({ searchParams }: DebtsPageProps) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Deudas</h1>
        <p className="text-sm text-muted-foreground">
          Tus tarjetas y préstamos, cuándo vencen y cuándo terminas de pagarlos.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<DebtsSkeleton />}>
        <DebtsContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function DebtsContent({
  searchParams
}: Pick<DebtsPageProps, "searchParams">) {
  const query = await searchParams
  const workspace = await getPersonalWorkspace()
  const tab = parseDebtsTab(query.tab)
  const debts = await getDebts(workspace.id)
  // Tras leer la sesión: todayISO usa new Date()
  const today = todayISO()

  return (
    <DebtsTabs tab={tab}>
      {tab === "debts" ? (
        <PayablesTab
          debts={debts.filter((debt) => debt.kind !== "receivable")}
          workspace={workspace}
          today={today}
        />
      ) : null}
    </DebtsTabs>
  )
}

function PayablesTab({
  debts,
  workspace,
  today
}: {
  /** Tarjetas y préstamos, en cualquier estado */
  debts: Debt[]
  workspace: PersonalWorkspace
  today: string
}) {
  const active = debts
    .filter((debt) => debt.status === "active")
    .sort(compareByNextDue)
  const inactive = debts.filter((debt) => debt.status !== "active")

  const createButton = (
    <DebtDialog
      trigger={
        <Button>
          <Plus data-icon="inline-start" />
          Nueva deuda
        </Button>
      }
    />
  )

  if (debts.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Registra tus tarjetas y préstamos"
        description="Lleva el saldo de cada deuda, sus pagos y cuándo vence. Tesoro te dice cuándo terminas de pagarla."
      >
        {createButton}
      </EmptyState>
    )
  }

  return (
    <>
      {/* Sin activas, la acción va en el estado vacío */}
      {active.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No tienes deudas activas"
          description="Registra una deuda nueva o reactiva una de las pagadas y archivadas."
        >
          {createButton}
        </EmptyState>
      ) : (
        <>
          <DebtTotals
            debts={debts}
            currency={workspace.currency}
          />

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Próximos pagos</h2>
            <UpcomingDebtPayments
              debts={active}
              today={today}
              currency={workspace.currency}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Tus deudas</h2>
              {createButton}
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {active.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  today={today}
                  currency={workspace.currency}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {inactive.length > 0 && (
        <InactiveDebts
          debts={inactive}
          currency={workspace.currency}
        />
      )}
    </>
  )
}

function DebtsSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </>
  )
}
