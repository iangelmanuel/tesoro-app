import { Suspense } from "react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton
} from "@heroui/react"
import { CreditCard, HandCoins, Plus } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { getAccountBalances } from "@/features/accounts/queries"
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
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Deudas",
  path: DEBTS_PATH,
  noindex: true
})

type DebtsPageProps = PageProps<"/dashboard/personal/debts">

export default function DebtsPage({ searchParams }: DebtsPageProps) {
  return (
    <section
      aria-label="Deudas"
      className="flex flex-1 flex-col gap-6"
    >
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
  const [debts, accounts] = await Promise.all([
    getDebts(workspace.id),
    getAccountBalances(workspace.id)
  ])
  const activeAccounts = accounts.filter((account) => !account.archived_at)
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
          accounts={activeAccounts}
          workspace={workspace}
          today={today}
        />
      ) : (
        <ReceivablesTab
          receivables={tabDebts}
          entries={entries}
          accounts={activeAccounts}
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
  accounts,
  workspace,
  today
}: {
  /** Cuentas por cobrar, en cualquier estado */
  receivables: Debt[]
  /** Abonos y ajustes por id de cuenta */
  entries: Record<string, DebtEntry[]>
  /** Cuentas activas, para el movimiento de un abono */
  accounts: PaymentAccountOption[]
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
          <Plus />
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
            <Amount
              value={totalReceivable(receivables)}
              currency={workspace.currency}
            />
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
              accounts={accounts}
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
  accounts,
  workspace,
  today
}: {
  /** Tarjetas y préstamos, en cualquier estado */
  debts: Debt[]
  /** Pagos y ajustes por id de deuda */
  entries: Record<string, DebtEntry[]>
  /** Cuentas activas, para el movimiento de un pago */
  accounts: PaymentAccountOption[]
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
          <Plus />
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

          <Card>
            <CardHeading title="Próximos pagos" />
            <CardContent>
              <UpcomingDebtPayments
                debts={active}
                today={today}
                currency={workspace.currency}
              />
            </CardContent>
          </Card>

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
                  accounts={accounts}
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
      <Skeleton className="h-9 w-48 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-24" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton className="h-56" />
        <CardSkeleton className="h-56" />
      </div>
    </>
  )
}
