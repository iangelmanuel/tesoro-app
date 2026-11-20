import Link from "next/link"
import { CreditCard } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/card-heading"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { HelpHint } from "@/components/dashboard/help-hint"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPercent } from "@/features/budgets/progress"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import {
  DEBTS_PATH,
  globalUtilization,
  isActiveDebt,
  totalDebt
} from "../calculations"
import { getDebts } from "../queries"
import { UtilizationBadge } from "./debt-indicators"
import { UpcomingDebtPayments } from "./upcoming-debt-payments"

const MAX_PAYMENTS = 3

interface DebtsCardProps {
  workspaceId: string
  currency: string
}

// Deuda total, utilización global y hasta 3 próximos pagos, vencidos primero.
// Las cuentas por cobrar no cuentan.
export async function DebtsCard({ workspaceId, currency }: DebtsCardProps) {
  const debts = await getDebts(workspaceId)
  const today = todayISO()
  const active = debts.filter(isActiveDebt)
  const utilization = globalUtilization(debts)

  return (
    <section
      aria-label="Deudas"
      className={CARD}
    >
      <CardHeading
        title="Deudas"
        href={DEBTS_PATH}
        linkLabel="Ver todas"
        linkContext="las deudas"
      />
      <div className="flex flex-col gap-4">
        {active.length === 0 ? (
          <CardEmpty
            icon={CreditCard}
            message="No tienes deudas activas"
            hint="Registra tarjetas y préstamos para ver qué pagar y cuándo."
            action={
              <Link
                href={DEBTS_PATH}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Registrar deuda
              </Link>
            }
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">Deuda total</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums">
                  <Amount
                    value={totalDebt(debts)}
                    currency={currency}
                  />
                </dd>
              </div>
              {utilization !== null && (
                <div className="flex flex-col gap-1">
                  <dt className="flex items-center gap-1 text-sm text-muted-foreground">
                    Utilización de tarjetas
                    <HelpHint topic="utilization" />
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2 text-xl font-semibold tabular-nums">
                    {formatPercent(utilization)}
                    <UtilizationBadge percent={utilization} />
                  </dd>
                </div>
              )}
            </dl>
            <UpcomingDebtPayments
              debts={active}
              today={today}
              currency={currency}
              limit={MAX_PAYMENTS}
            />
          </>
        )}
      </div>
    </section>
  )
}

/** Deudas mientras carga: total, utilización y tres pagos */
export function DebtsCardSkeleton() {
  return (
    <div className={CARD}>
      <CardHeadingSkeleton />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-1"
            >
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
        <ul className={CARD_LIST}>
          {Array.from({ length: 3 }, (_, index) => (
            <li
              key={index}
              className={cn("flex items-center gap-4", CARD_ROW)}
            >
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-6 w-24" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
