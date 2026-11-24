import { ShieldCheck } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  CardHeading,
  CardHeadingSkeleton
} from "@/components/dashboard/data/card-heading"
import { CARD, CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { CardEmpty } from "@/components/dashboard/feedback/empty-state"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { cn } from "@/libs/cn"
import { currentMonth } from "@/libs/dates"
import { formatPercentLabel } from "@/libs/format"
import {
  BUDGET_STATUS_LABELS,
  WARNING_RATIO,
  budgetPercent,
  budgetStatus
} from "../progress"
import { getBudgetProgress } from "../queries"
import { BUDGETS_PATH } from "../tabs"
import { BudgetProgressBar, STATUS_BADGE_CLASSES } from "./budget-progress-row"

const MAX_BUDGETS = 5

interface BudgetsAtRiskCardProps {
  workspaceId: string
  currency: string
}

// Hasta 5 presupuestos del mes actual con gastado ≥ 80 %, de mayor a menor %
export async function BudgetsAtRiskCard({
  workspaceId,
  currency
}: BudgetsAtRiskCardProps) {
  const progress = await getBudgetProgress(workspaceId, currentMonth())
  const atRisk = progress
    .flatMap((row) =>
      row.budgetAmount === null
        ? []
        : [{ ...row, budgetAmount: row.budgetAmount }]
    )
    .filter((row) => row.spent / row.budgetAmount >= WARNING_RATIO)
    .sort((a, b) => b.spent / b.budgetAmount - a.spent / a.budgetAmount)
    .slice(0, MAX_BUDGETS)

  return (
    <section
      aria-label="Presupuestos en riesgo"
      className={CARD}
    >
      <CardHeading
        title="Presupuestos en riesgo"
        href={BUDGETS_PATH}
        linkLabel="Ver todos"
        linkContext="los presupuestos"
      />
      <div>
        {atRisk.length === 0 && (
          <CardEmpty
            icon={ShieldCheck}
            message="Ningún presupuesto en riesgo"
            hint="Te avisamos aquí cuando uno pase del 80 %."
          />
        )}
        <ul className={CARD_LIST}>
          {atRisk.map((row) => {
            const status = budgetStatus(row.spent, row.budgetAmount)
            return (
              <li
                key={row.categoryId}
                className={cn("flex flex-col gap-2", CARD_ROW)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge
                    name={row.name}
                    icon={row.icon}
                    color={row.color}
                  />
                  <ToneBadge className={STATUS_BADGE_CLASSES[status]}>
                    {BUDGET_STATUS_LABELS[status]}
                  </ToneBadge>
                  <p className="ml-auto text-sm font-medium tabular-nums">
                    {formatPercentLabel(
                      budgetPercent(row.spent, row.budgetAmount)
                    )}
                  </p>
                </div>
                <BudgetProgressBar
                  spent={row.spent}
                  committed={row.committed}
                  budget={row.budgetAmount}
                  label={`${row.name}: ${formatPercentLabel(budgetPercent(row.spent, row.budgetAmount))}`}
                />
                <p className="text-sm text-muted-foreground tabular-nums">
                  <Amount
                    value={row.spent}
                    currency={currency}
                  />{" "}
                  de{" "}
                  <Amount
                    value={row.budgetAmount}
                    currency={currency}
                  />
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** Presupuestos en riesgo mientras carga: cabecera y tres filas */
export function BudgetsAtRiskCardSkeleton() {
  return (
    <div className={CARD}>
      <CardHeadingSkeleton />
      <ul className={CARD_LIST}>
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className={cn("flex flex-col gap-2", CARD_ROW)}
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-28 rounded-4xl" />
              <Skeleton className="h-6 w-20 rounded-4xl" />
              <Skeleton className="ml-auto h-5 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-5 w-40" />
          </li>
        ))}
      </ul>
    </div>
  )
}
