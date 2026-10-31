import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  buttonVariants
} from "@heroui/react"
import { CreditCard } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
      <div className="flex items-start justify-between gap-2">
        <CardHeader>
          <CardTitle>Deudas</CardTitle>
          <CardDescription>Tarjetas y préstamos activos</CardDescription>
        </CardHeader>
        <div className="shrink-0">
          <Link
            href={DEBTS_PATH}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver todas
          </Link>
        </div>
      </div>
      <CardContent className="flex flex-col gap-4">
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <CardEmpty
              icon={CreditCard}
              message="No tienes deudas activas"
            />
            <Link
              href={DEBTS_PATH}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Registrar deuda
            </Link>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted">Deuda total</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatCurrency(totalDebt(debts), currency)}
                </dd>
              </div>
              {utilization !== null && (
                <div className="flex flex-col gap-1">
                  <dt className="text-sm text-muted">
                    Utilización de tarjetas
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
