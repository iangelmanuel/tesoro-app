import { cn } from "cn"
import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground"
}

export function OccurrenceStatusBadge({
  status
}: {
  status: OccurrenceStatus
}) {
  const { label, tone } = OCCURRENCE_STATUS[status]
  return <Badge className={TONE_CLASSES[tone]}>{label}</Badge>
}

interface PayOccurrenceButtonProps {
  payment: UpcomingPayment
  categories: Category[]
}

// Abre TransactionDialog prellenado con la ocurrencia y enlazado a ella. El
// usuario confirma (y puede cambiar el monto) antes de crear el movimiento.
export function PayOccurrenceButton({
  payment,
  categories
}: PayOccurrenceButtonProps) {
  return (
    <TransactionDialog
      categories={categories}
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
        <Button
          size="sm"
          variant="outline"
        >
          <Check data-icon="inline-start" />
          Marcar como pagado
        </Button>
      }
    />
  )
}

interface UpcomingPaymentsProps {
  payments: UpcomingPayment[]
  categories: Category[]
  currency: string
}

export function UpcomingPayments({
  payments,
  categories,
  currency
}: UpcomingPaymentsProps) {
  return (
    <ul className="divide-y rounded-xl border">
      {payments.map((payment) => (
        <li
          key={`${payment.recurringExpenseId}-${payment.dueOn}`}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{payment.name}</p>
              <OccurrenceStatusBadge status={payment.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{formatDate(payment.dueOn)}</span>
              <CategoryBadge
                name={payment.category.name}
                icon={payment.category.icon}
                color={payment.category.color}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {payment.paidAmount !== null ? (
              <p className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatCurrency(payment.paidAmount, currency)}
              </p>
            ) : (
              <>
                <p
                  className={cn(
                    "font-medium tabular-nums",
                    payment.status === "overdue" &&
                      "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {formatCurrency(payment.amount, currency)}
                </p>
                <PayOccurrenceButton
                  payment={payment}
                  categories={categories}
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
