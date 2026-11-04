import { Card, CardContent, Chip } from "@heroui/react"
import { ShieldCheck } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { CardHeading } from "@/components/dashboard/card-heading"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { currentMonth } from "@/libs/dates"
import {
  BUDGET_STATUS_LABELS,
  WARNING_RATIO,
  budgetPercent,
  budgetStatus,
  formatPercent
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
    <Card>
      <CardHeading
        title="Presupuestos en riesgo"
        href={BUDGETS_PATH}
        linkLabel="Ver todos"
        linkContext="los presupuestos"
      />
      <CardContent>
        {atRisk.length === 0 && (
          <CardEmpty
            icon={ShieldCheck}
            message="Ningún presupuesto en riesgo"
            hint="Te avisamos aquí cuando uno pase del 80 %."
          />
        )}
        <ul className="flex flex-col divide-y">
          {atRisk.map((row) => {
            const status = budgetStatus(row.spent, row.budgetAmount)
            return (
              <li
                key={row.categoryId}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge
                    name={row.name}
                    icon={row.icon}
                    color={row.color}
                  />
                  <Chip
                    size="sm"
                    className={STATUS_BADGE_CLASSES[status]}
                    color="accent"
                    variant="primary"
                  >
                    {BUDGET_STATUS_LABELS[status]}
                  </Chip>
                  <p className="ml-auto text-sm font-medium tabular-nums">
                    {formatPercent(budgetPercent(row.spent, row.budgetAmount))}
                  </p>
                </div>
                <BudgetProgressBar
                  spent={row.spent}
                  committed={row.committed}
                  budget={row.budgetAmount}
                  label={`${row.name}: ${formatPercent(budgetPercent(row.spent, row.budgetAmount))}`}
                />
                <p className="text-sm text-muted tabular-nums">
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
      </CardContent>
    </Card>
  )
}
