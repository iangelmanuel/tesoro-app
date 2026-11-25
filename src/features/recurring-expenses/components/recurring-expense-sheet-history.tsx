"use client"

import { Check } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { RecordedPaymentActions } from "@/features/transactions/components/recorded-payment-actions"
import { cn } from "@/libs/cn"
import { formatShortDate } from "@/libs/format"
import type { RecurringExpenseHistory, UpcomingPayment } from "../queries"
import { canDuplicatePayment, periodLabel } from "../recurring-expense-history"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

/** Lo que necesitan Editar y Eliminar de un pago registrado (SPEC 42) */
interface PaymentEditing {
  workspaceId: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  onChanged: () => void
}

/** Periodos de un gasto fijo en su Sheet, el más reciente primero (SPEC 37) */
export function RecurringExpenseSheetHistory({
  history,
  isYearly,
  currency,
  hasFutureOccurrences,
  payments,
  onPay,
  onShowMore
}: {
  history: RecurringExpenseHistory
  isYearly: boolean
  currency: string
  /** Quedan ocurrencias después del mes actual */
  hasFutureOccurrences: boolean
  payments: PaymentEditing
  onPay: (payment: UpcomingPayment) => void
  onShowMore: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {history.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no tiene periodos: empieza más adelante.
        </p>
      ) : (
        <ul className={CARD_LIST}>
          {history.payments.map((payment) => (
            <HistoryRow
              key={payment.dueOn}
              payment={payment}
              isYearly={isYearly}
              currency={currency}
              // Duplicar paga la siguiente ocurrencia sin pagar: se oculta si
              // no queda ninguna después de esta
              canDuplicate={canDuplicatePayment(
                history.payments,
                payment,
                hasFutureOccurrences
              )}
              paymentEditing={payments}
              onPay={onPay}
            />
          ))}
        </ul>
      )}

      {history.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onShowMore}
        >
          Ver más
        </Button>
      )}
    </div>
  )
}

function HistoryRow({
  payment,
  isYearly,
  currency,
  canDuplicate,
  paymentEditing,
  onPay
}: {
  payment: UpcomingPayment
  isYearly: boolean
  currency: string
  canDuplicate: boolean
  paymentEditing: PaymentEditing
  onPay: (payment: UpcomingPayment) => void
}) {
  const period = periodLabel(payment, isYearly)
  const isPaid = payment.transactionId !== null

  return (
    <li
      className={cn(
        CARD_ROW,
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium first-letter:uppercase">
            {period}
          </span>
          <OccurrenceStatusBadge status={payment.status} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {isPaid && payment.paidOn !== null
            ? `Pagado el ${formatShortDate(payment.paidOn)} · vencía el ${formatShortDate(payment.dueOn)}`
            : `Vence el ${formatShortDate(payment.dueOn)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {payment.transactionId !== null ? (
          <>
            <span
              className={cn("text-sm font-medium", TONE_TEXT_CLASSES.success)}
            >
              <Amount
                value={payment.paidAmount ?? payment.amount}
                currency={currency}
              />
            </span>
            {/* El mismo movimiento que en Movimientos (SPEC 42) */}
            <RecordedPaymentActions
              {...paymentEditing}
              transactionId={payment.transactionId}
              noun="pago"
              canDuplicate={canDuplicate}
              deleteEffect={`${period} vuelve a quedar por pagar`}
            />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPay(payment)}
          >
            <Check />
            Marcar como pagado
          </Button>
        )}
      </div>
    </li>
  )
}
