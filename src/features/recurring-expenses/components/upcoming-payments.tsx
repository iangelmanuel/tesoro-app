import { Button, Chip, cn } from "@heroui/react"
import { Check } from "lucide-react"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { formatCurrency, formatDate } from "@/libs/format"
import {
  OCCURRENCE_STATUS,
  type OccurrenceStatus,
  type OccurrenceTone
} from "../occurrences"
import type { UpcomingPayment } from "../queries"

const TONE_CLASSES: Record<OccurrenceTone, string> = {
  success: TONE_BADGE.success,
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  neutral: "bg-default text-muted"
}

export function OccurrenceStatusBadge({
  status
}: {
  status: OccurrenceStatus
}) {
  const { label, tone } = OCCURRENCE_STATUS[status]
  return (
    <Chip
      size="sm"
      className={TONE_CLASSES[tone]}
      color="accent"
      variant="primary"
    >
      {label}
    </Chip>
  )
}

interface PayOccurrenceButtonProps {
  workspaceId: string
  payment: UpcomingPayment
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Clases del botón (ancho y alto táctil en el teléfono) */
  className?: string
}

// Abre TransactionDialog prellenado con la ocurrencia y enlazado a ella. El
// usuario confirma (y puede cambiar el monto) antes de crear el movimiento.
export function PayOccurrenceButton({
  workspaceId,
  payment,
  categories,
  accounts,
  className
}: PayOccurrenceButtonProps) {
  return (
    <TransactionDialog
      workspaceId={workspaceId}
      categories={categories}
      accounts={accounts}
      initialValues={{
        amount: payment.amount,
        category_id: payment.category.id,
        occurred_on: payment.dueOn,
        description: payment.name
      }}
      recurring={{
        recurringExpenseId: payment.recurringExpenseId,
        dueOn: payment.dueOn
      }}
      trigger={
        // key: el Modal de HeroUI recorre sus hijos como lista y, con el
        // botón creado en otro componente, React avisa de la falta de key
        <Button
          key="pay-occurrence"
          size="sm"
          variant="outline"
          className={className}
          data-tour="recurring-pay"
        >
          <Check />
          Marcar como pagado
        </Button>
      }
    />
  )
}

interface UpcomingPaymentsProps {
  workspaceId: string
  payments: UpcomingPayment[]
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
}

// Monto pagado (verde) o pendiente (rojo si venció), en una sola línea
function AmountText({
  payment,
  currency,
  className
}: {
  payment: UpcomingPayment
  currency: string
  className?: string
}) {
  const paid = payment.paidAmount !== null
  return (
    <p
      className={cn(
        "shrink-0 font-medium whitespace-nowrap tabular-nums",
        paid && "text-(--income)",
        !paid && payment.status === "overdue" && "text-(--expense)",
        className
      )}
    >
      {formatCurrency(payment.paidAmount ?? payment.amount, currency)}
    </p>
  )
}

export function UpcomingPayments({
  workspaceId,
  payments,
  categories,
  accounts,
  currency
}: UpcomingPaymentsProps) {
  return (
    <ul className={CARD_LIST}>
      {payments.map((payment) => (
        <li
          key={`${payment.recurringExpenseId}-${payment.dueOn}`}
          className={cn(
            "flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4",
            CARD_ROW
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 font-medium break-words">
                  {payment.name}
                </p>
                <OccurrenceStatusBadge status={payment.status} />
              </div>
              {/* < 768 px: el monto va junto al nombre */}
              <AmountText
                payment={payment}
                currency={currency}
                className="md:hidden"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="whitespace-nowrap">
                {formatDate(payment.dueOn)}
              </span>
              {payment.transactionId !== null && (
                <span>
                  {payment.accountName
                    ? `Desde ${payment.accountName}`
                    : "Fuera de cuentas"}
                </span>
              )}
              <CategoryBadge
                name={payment.category.name}
                icon={payment.category.icon}
                color={payment.category.color}
              />
            </div>
          </div>
          <div className="contents md:flex md:items-center md:gap-3">
            <AmountText
              payment={payment}
              currency={currency}
              className="max-md:hidden"
            />
            {payment.paidAmount === null && (
              <PayOccurrenceButton
                workspaceId={workspaceId}
                payment={payment}
                categories={categories}
                accounts={accounts}
                className="max-md:min-h-11 max-md:w-full"
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
