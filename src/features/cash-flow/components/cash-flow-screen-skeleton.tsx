import { CARD, CONTROL_SURFACE } from "@/components/dashboard/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import { AccountBalancesListSkeleton } from "./account-balances-list"
import { CashFlowTableSkeleton } from "./cash-flow-table"

/** Cabecera de una tarjeta de Flujo de caja: título y descripción */
function CardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-5 w-full max-w-72" />
    </div>
  )
}

/**
 * Flujo de caja mientras carga: selector de periodo, gráfica, tabla mes a
 * mes y saldos, con la misma grilla que el contenido. Lo usan el Suspense
 * de la página y su loading.tsx
 */
export function CashFlowScreenSkeleton() {
  return (
    <>
      <div
        aria-hidden="true"
        className="flex flex-wrap items-center gap-2"
      >
        <Skeleton className="h-11 w-40 rounded-4xl" />
        <div
          className={cn(
            "flex min-h-11 items-center rounded-3xl p-0.5",
            CONTROL_SURFACE
          )}
        >
          <span className="size-11 md:size-10" />
          <span className="flex min-w-32 justify-center px-1">
            <Skeleton className="h-4 w-24" />
          </span>
          <span className="size-11 md:size-10" />
        </div>
      </div>
      <div className={CARD}>
        <CardHeaderSkeleton />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex flex-col gap-3 lg:col-span-2">
          <Skeleton className="h-7 w-28" />
          <CashFlowTableSkeleton />
        </section>
        <div className={cn(CARD, "self-start")}>
          <CardHeaderSkeleton />
          <AccountBalancesListSkeleton />
        </div>
      </div>
    </>
  )
}
