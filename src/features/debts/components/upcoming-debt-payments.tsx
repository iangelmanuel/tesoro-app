import { cn } from "cn"
import { formatCurrency, formatDate } from "@/libs/format"
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
 * Próximo vencimiento de cada tarjeta y préstamo activo con saldo, vencidos
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
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        No tienes pagos de deudas pendientes
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {items.map(({ debt, payment }) => (
        <li
          key={debt.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
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
                payment.status === "overdue" &&
                  "text-rose-600 dark:text-rose-400",
                payment.status === "paid" &&
                  "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {formatCurrency(payment.amount, currency)}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
