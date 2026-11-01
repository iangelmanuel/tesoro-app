import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  buttonVariants
} from "@heroui/react"
import { ShieldCheck } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import { currentMonth } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
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
      <div className="flex items-start justify-between gap-2">
        <CardHeader>
          <CardTitle>Presupuestos en riesgo</CardTitle>
          <CardDescription>
            Cerca del límite o excedidos este mes
          </CardDescription>
        </CardHeader>
        <div className="shrink-0">
          <Link
            href={BUDGETS_PATH}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver todos
          </Link>
        </div>
      </div>
      <CardContent>
        {atRisk.length === 0 && (
          <CardEmpty
            icon={ShieldCheck}
            message="Ningún presupuesto en riesgo"
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
                />
                <p className="text-sm text-muted tabular-nums">
                  {formatCurrency(row.spent, currency)} de{" "}
                  {formatCurrency(row.budgetAmount, currency)}
                </p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
