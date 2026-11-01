import Link from "next/link"
import { Card, CardContent, buttonVariants } from "@heroui/react"
import { CreditCard } from "lucide-react"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { HelpHint } from "@/components/dashboard/help-hint"
import { formatPercent } from "@/features/budgets/progress"
import { todayISO } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
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
    <Card>
      <CardHeading
        title="Deudas"
        href={DEBTS_PATH}
        linkLabel="Ver todas"
        linkContext="las deudas"
      />
      <CardContent className="flex flex-col gap-4">
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
                <dt className="text-sm text-muted">Deuda total</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(totalDebt(debts), currency)}
                </dd>
              </div>
              {utilization !== null && (
                <div className="flex flex-col gap-1">
                  <dt className="flex items-center gap-1 text-sm text-muted">
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
      </CardContent>
    </Card>
  )
}
