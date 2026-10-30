import type { Route } from "next"
import Link from "next/link"
import { CircleCheck } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { getAccountBalances } from "@/features/accounts/queries"
import { BUDGETS_PATH } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { getUpcomingPayments } from "../queries"
import { OccurrenceStatusBadge, PayOccurrenceButton } from "./upcoming-payments"

const MAX_PAYMENTS = 5
const RECURRING_HREF = `${BUDGETS_PATH}?tab=recurring` as Route

interface UpcomingPaymentsCardProps {
  workspaceId: string
  currency: string
}

// Hasta 5 ocurrencias pendientes. Vienen en orden de vencimiento, así que
// las vencidas quedan primero.
export async function UpcomingPaymentsCard({
  workspaceId,
  currency
}: UpcomingPaymentsCardProps) {
  const [payments, categories, accounts] = await Promise.all([
    getUpcomingPayments(workspaceId),
    getCategories(workspaceId),
    getAccountBalances(workspaceId)
  ])
  const pending = payments
    .filter((payment) => payment.transactionId === null)
    .slice(0, MAX_PAYMENTS)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos pagos</CardTitle>
        <CardDescription>Gastos fijos pendientes</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link href={RECURRING_HREF}>Ver todos</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {pending.length === 0 && (
          <CardEmpty
            icon={CircleCheck}
            message="No tienes pagos pendientes"
          />
        )}
        <ul className="flex flex-col divide-y">
          {pending.map((payment) => (
            <li
              key={`${payment.recurringExpenseId}-${payment.dueOn}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{payment.name}</p>
                  <OccurrenceStatusBadge status={payment.status} />
                </div>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(payment.dueOn)} ·{" "}
                  {formatCurrency(payment.amount, currency)}
                </p>
              </div>
              <PayOccurrenceButton
                payment={payment}
                categories={categories}
                accounts={accounts}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
