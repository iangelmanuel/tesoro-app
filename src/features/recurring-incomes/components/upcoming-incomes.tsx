import { Chip, cn } from "@heroui/react"
import { Amount } from "@/components/dashboard/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES as TONE_BADGE } from "@/components/dashboard/tone"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { formatDate } from "@/libs/format"
import {
  INCOME_OCCURRENCE_STATUS,
  type IncomeOccurrenceStatus,
  type IncomeOccurrenceTone
} from "../occurrences"
import type { UpcomingIncome } from "../queries"

const TONE_CLASSES: Record<IncomeOccurrenceTone, string> = {
  success: TONE_BADGE.success,
  danger: TONE_BADGE.danger,
  warning: TONE_BADGE.warning,
  neutral: "bg-default text-muted"
}

export function IncomeStatusBadge({
  status
}: {
  status: IncomeOccurrenceStatus
}) {
  const { label, tone } = INCOME_OCCURRENCE_STATUS[status]
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

// Monto recibido (verde) o esperado (rojo si está atrasado), en una línea
function AmountText({
  income,
  currency,
  className
}: {
  income: UpcomingIncome
  currency: string
  className?: string
}) {
  const received = income.receivedAmount !== null
  return (
    <p
      className={cn(
        "shrink-0 font-medium whitespace-nowrap",
        received && "text-(--income)",
        !received && income.status === "overdue" && "text-(--expense)",
        className
      )}
    >
      <Amount
        value={income.receivedAmount ?? income.amount}
        currency={currency}
      />
    </p>
  )
}

interface UpcomingIncomesProps {
  incomes: UpcomingIncome[]
  currency: string
  /** Acción de cada ocurrencia sin recibir ("Marcar recibido") */
  renderAction?: (income: UpcomingIncome) => React.ReactNode
}

export function UpcomingIncomes({
  incomes,
  currency,
  renderAction
}: UpcomingIncomesProps) {
  return (
    <ul className={CARD_LIST}>
      {incomes.map((income) => (
        <li
          key={`${income.recurringIncomeId}-${income.dueOn}`}
          className={cn(
            "flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4",
            CARD_ROW
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="min-w-0 font-medium break-words">{income.name}</p>
                <IncomeStatusBadge status={income.status} />
              </div>
              {/* < 768 px: el monto va junto al nombre */}
              <AmountText
                income={income}
                currency={currency}
                className="md:hidden"
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="whitespace-nowrap">
                {formatDate(income.dueOn)}
              </span>
              {income.transactionId !== null && (
                <span>
                  {income.accountName
                    ? `En ${income.accountName}`
                    : "Fuera de cuentas"}
                </span>
              )}
              <CategoryBadge
                name={income.category.name}
                icon={income.category.icon}
                color={income.category.color}
              />
            </div>
          </div>
          <div className="contents md:flex md:items-center md:gap-3">
            <AmountText
              income={income}
              currency={currency}
              className="max-md:hidden"
            />
            {income.receivedAmount === null && renderAction?.(income)}
          </div>
        </li>
      ))}
    </ul>
  )
}
