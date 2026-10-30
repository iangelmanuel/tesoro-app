import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { formatPercent } from "@/features/budgets/progress"
import { formatCurrency } from "@/libs/format"
import {
  globalUtilization,
  totalDebt,
  totalMonthlyInterest
} from "../calculations"
import type { Debt } from "../queries"
import { UtilizationBadge } from "./debt-indicators"

interface DebtTotalsProps {
  /** Todas las deudas; los totales solo cuentan tarjetas y préstamos activos */
  debts: Debt[]
  currency: string
}

export function DebtTotals({ debts, currency }: DebtTotalsProps) {
  const utilization = globalUtilization(debts)

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Deuda total</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCurrency(totalDebt(debts), currency)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Utilización de tarjetas</CardDescription>
          {utilization === null ? (
            <CardTitle className="text-2xl font-semibold text-muted-foreground">
              Sin tarjetas
            </CardTitle>
          ) : (
            <CardTitle className="flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums">
              {formatPercent(utilization)}
              <UtilizationBadge percent={utilization} />
            </CardTitle>
          )}
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Interés estimado del mes</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {formatCurrency(totalMonthlyInterest(debts), currency)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
