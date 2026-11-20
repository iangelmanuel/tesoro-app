import { Amount } from "@/components/dashboard/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/tone"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import { upcomingPayments } from "../calculations"
import type { Debt } from "../queries"
import { PaymentStatusBadge } from "./debt-indicators"

interface UpcomingDebtPaymentsProps {
  debts: Debt[]
  /** Hoy en America/Bogota, calculado en el servidor */
  today: string
  currency: string
  /** Máximo de filas (la tarjeta del Resumen muestra 3) */
  limit?: number
}

/**
 * Lista sin caja propia: va dentro de una tarjeta. Próximo vencimiento de cada tarjeta y préstamo activo con saldo, vencidos
 * primero y luego por fecha
 */
export function UpcomingDebtPayments({
  debts,
  today,
  currency,
  limit
}: UpcomingDebtPaymentsProps) {
  const items = upcomingPayments(debts, today).slice(0, limit)

  if (items.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No tienes pagos de deudas pendientes
      </p>
    )
  }

  return (
    <ul className={CARD_LIST}>
      {items.map(({ debt, payment }) => (
        <li
          key={debt.id}
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-2",
            CARD_ROW
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{debt.name}</p>
              {/* Tarjeta sin pago mínimo: solo fecha, sin estado */}
              {payment.status && <PaymentStatusBadge status={payment.status} />}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(payment.dueOn)}
            </p>
          </div>
          {payment.amount !== null && (
            <p
              className={cn(
                "font-medium tabular-nums",
                payment.status === "overdue" && TONE_TEXT_CLASSES.danger,
                payment.status === "paid" && TONE_TEXT_CLASSES.success
              )}
            >
              <Amount
                value={payment.amount}
                currency={currency}
              />
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Filas de próximos pagos mientras cargan */
export function UpcomingDebtPaymentsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className={CARD_LIST}>
      {Array.from({ length: rows }, (_, index) => (
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
  )
}
