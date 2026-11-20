import type { Route } from "next"
import { CircleCheck } from "lucide-react"
import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/card-heading"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { MonthSwitcherSkeleton } from "@/components/dashboard/month-switcher"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { getAccountBalances } from "@/features/accounts/queries"
import { RECURRING_PATH } from "@/features/budgets/tabs"
import { getCategories } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatCurrency, formatDate } from "@/libs/format"
import { getUpcomingPayments } from "../queries"
import { OccurrenceStatusBadge, PayOccurrenceButton } from "./upcoming-payments"

const MAX_PAYMENTS = 5
const RECURRING_HREF = RECURRING_PATH as Route

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
    <section
      aria-label="Próximos pagos"
      className={CARD}
    >
      <CardHeading
        title="Próximos pagos"
        href={RECURRING_HREF}
        linkLabel="Ver todos"
        linkContext="los gastos fijos"
      />
      <div>
        {pending.length === 0 && (
          <CardEmpty
            icon={CircleCheck}
            message="No tienes pagos pendientes"
            hint="Tus gastos fijos aparecen aquí antes de vencer."
          />
        )}
        <ul className={CARD_LIST}>
          {pending.map((payment) => (
            <li
              key={`${payment.recurringExpenseId}-${payment.dueOn}`}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2",
                CARD_ROW
              )}
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
                workspaceId={workspaceId}
                payment={payment}
                categories={categories}
                accounts={accounts}
                className="max-md:w-full"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Próximos pagos mientras carga: cabecera y tres filas con su botón */
export function UpcomingPaymentsCardSkeleton({
  withMonth = false
}: {
  /** Reserva el selector de mes de la cabecera (pantalla de Gastos fijos) */
  withMonth?: boolean
}) {
  return (
    <div className={CARD}>
      {withMonth ? (
        // Misma cabecera que CardHeading con `control`: en el teléfono el
        // selector baja a su propia fila
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="order-last w-full md:order-none md:ml-auto md:w-auto">
            <MonthSwitcherSkeleton on="card" />
          </div>
        </div>
      ) : (
        <CardHeadingSkeleton />
      )}
      <ul className={CARD_LIST}>
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2",
              CARD_ROW
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20 rounded-4xl" />
              </div>
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-9 w-44 rounded-4xl max-md:w-full" />
          </li>
        ))}
      </ul>
    </div>
  )
}
