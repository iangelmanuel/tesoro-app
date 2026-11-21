import { CardHeadingSkeleton } from "@/components/dashboard/data/card-heading"
import { CARD } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { DebtCardSkeleton } from "./debt-card"
import { DebtTotalsSkeleton } from "./debt-totals"
import { DebtsTabsSkeleton } from "./debts-tabs"
import { UpcomingDebtPaymentsSkeleton } from "./upcoming-debt-payments"

/**
 * Deudas mientras carga (tab Debo, la de por defecto): tabs, KPIs, próximos
 * vencimientos y la grilla, con los mismos contenedores que el contenido
 */
export function DebtsScreenSkeleton() {
  return (
    <>
      <DebtsTabsSkeleton />
      <DebtTotalsSkeleton />
      <div className={CARD}>
        <CardHeadingSkeleton />
        <UpcomingDebtPaymentsSkeleton />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-11 w-40 rounded-4xl" />
        </div>
        <ul className="grid gap-4 lg:grid-cols-2">
          <DebtCardSkeleton />
          <DebtCardSkeleton />
        </ul>
      </div>
    </>
  )
}
