import { Suspense } from "react"
import { CreditCard, HandCoins, Plus } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DEBTS_PATH,
  compareByExpectedOn,
  compareByNextDue,
  totalReceivable
} from "@/features/debts/calculations"
import { DebtCard } from "@/features/debts/components/debt-card"
import { DebtDialog } from "@/features/debts/components/debt-dialog"
import { DebtTotals } from "@/features/debts/components/debt-totals"
import { DebtsTabs } from "@/features/debts/components/debts-tabs"
import { InactiveDebts } from "@/features/debts/components/inactive-debts"
import { InactiveReceivables } from "@/features/debts/components/inactive-receivables"
import { ReceivableCard } from "@/features/debts/components/receivable-card"
import { ReceivableDialog } from "@/features/debts/components/receivable-dialog"
import { UpcomingDebtPayments } from "@/features/debts/components/upcoming-debt-payments"
import {
  type Debt,
  type DebtEntry,
  getDebtEntries,
  getDebts
} from "@/features/debts/queries"
import { parseDebtsTab } from "@/features/debts/tabs"
import { ImportButton } from "@/features/imports/components/import-button"
import {
  type PersonalWorkspace,
  getPersonalWorkspace
} from "@/features/workspaces/queries"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
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
          Lo que debes, lo que te deben y cuándo terminas de pagar.
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
  const tabDebts = debts.filter((debt) =>
    tab === "debts" ? debt.kind !== "receivable" : debt.kind === "receivable"
  )

  // Historial de cada deuda de la tab para su Sheet. Solo se consultan las
  // que tienen pagos o ajustes.
  const entries: Record<string, DebtEntry[]> = Object.fromEntries(
    await Promise.all(
      tabDebts.map(async (debt) => [
        debt.id,
        debt.entries_count > 0 ? await getDebtEntries(debt.id) : []
      ])
    )
  )

  return (
    <DebtsTabs tab={tab}>
      {tab === "debts" ? (
        <PayablesTab
          debts={tabDebts}
          entries={entries}
          workspace={workspace}
          today={today}
        />
      ) : (
        <ReceivablesTab
          receivables={tabDebts}
          entries={entries}
          workspace={workspace}
          today={today}
        />
      )}
    </DebtsTabs>
  )
}

function ReceivablesTab({
  receivables,
  entries,
  workspace,
  today
}: {
  /** Cuentas por cobrar, en cualquier estado */
  receivables: Debt[]
  /** Abonos y ajustes por id de cuenta */
  entries: Record<string, DebtEntry[]>
  workspace: PersonalWorkspace
  today: string
}) {
  const active = receivables
    .filter((receivable) => receivable.status === "active")
    .sort(compareByExpectedOn)
  const inactive = receivables.filter(
    (receivable) => receivable.status !== "active"
  )

  const createButton = (
    <ReceivableDialog
      trigger={
        <Button>
          <Plus data-icon="inline-start" />
          Nueva cuenta por cobrar
        </Button>
      }
    />
  )

  if (active.length === 0) {
    return (
      <>
        <EmptyState
          icon={HandCoins}
          title="Nadie te debe dinero por ahora"
          description="Registra lo que prestaste y los abonos que te hagan, y sabrás cuánto te falta por cobrar."
        >
          {createButton}
        </EmptyState>
        {inactive.length > 0 && (
          <InactiveReceivables
            debts={inactive}
            entries={entries}
            today={today}
            currency={workspace.currency}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Card className="sm:max-w-xs">
        <CardHeader>
          <CardDescription>Te deben</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCurrency(totalReceivable(receivables), workspace.currency)}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Cuentas por cobrar</h2>
          <div className="flex flex-wrap gap-2">
            <ImportButton target="debt_entries" />
            {createButton}
          </div>
        </div>
        <ul className="grid gap-4 lg:grid-cols-2">
          {active.map((receivable) => (
            <ReceivableCard
              key={receivable.id}
              receivable={receivable}
              entries={entries[receivable.id] ?? []}
              today={today}
              currency={workspace.currency}
            />
          ))}
        </ul>
      </div>

      {inactive.length > 0 && (
        <InactiveReceivables
          debts={inactive}
          entries={entries}
          today={today}
          currency={workspace.currency}
        />
      )}
    </>
  )
}

function PayablesTab({
  debts,
  entries,
  workspace,
  today
}: {
  /** Tarjetas y préstamos, en cualquier estado */
  debts: Debt[]
  /** Pagos y ajustes por id de deuda */
  entries: Record<string, DebtEntry[]>
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
              <div className="flex flex-wrap gap-2">
                <ImportButton target="debt_entries" />
                {createButton}
              </div>
            </div>
            <ul className="grid gap-4 lg:grid-cols-2">
              {active.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  entries={entries[debt.id] ?? []}
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
          entries={entries}
          today={today}
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
