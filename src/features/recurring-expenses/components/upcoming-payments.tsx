import { Button, Chip, cn } from "@heroui/react"
import { Check } from "lucide-react"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
import type { AccountOption } from "@/features/accounts/components/account-select"
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
  accounts: AccountOption[]
}

// Abre TransactionDialog prellenado con la ocurrencia y enlazado a ella. El
// usuario confirma (y puede cambiar el monto) antes de crear el movimiento.
export function PayOccurrenceButton({
  workspaceId,
  payment,
  categories,
  accounts
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
        <Button
          size="sm"
          variant="outline"
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
  accounts: AccountOption[]
  currency: string
}

export function UpcomingPayments({
  workspaceId,
  payments,
  categories,
  accounts,
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
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
                    payment.status === "overdue" && "text-(--expense)"
                  )}
                >
                  {formatCurrency(payment.amount, currency)}
                </p>
                <PayOccurrenceButton
                  workspaceId={workspaceId}
                  payment={payment}
                  categories={categories}
                  accounts={accounts}
                />
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
