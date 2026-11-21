import {
  StatCard,
  StatCardSkeleton
} from "@/components/dashboard/data/stat-card"
import type { TransactionTotals } from "../queries"

interface TransactionsTotalsProps {
  totals: TransactionTotals
  currency: string
  /** Mismos filtros en el mes anterior; null = sin badge (todos los meses) */
  previous?: TransactionTotals | null
  /** Alcance de los totales: "Octubre 2026 · con filtros" */
  caption?: string
}

// KPI pequeñas de lo que muestra la tabla. El badge compara con los mismos
// filtros en el mes anterior; con "todos los meses" no hay anterior
export function TransactionsTotals({
  totals,
  currency,
  previous,
  caption
}: TransactionsTotalsProps) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      data-tour="transactions-totals"
    >
      <StatCard
        size="sm"
        label="Entradas"
        value={totals.income}
        previous={previous?.income}
        trend="higher-is-better"
        currency={currency}
        caption={caption}
      />
      <StatCard
        size="sm"
        label="Salidas"
        value={totals.expense}
        previous={previous?.expense}
        trend="lower-is-better"
        currency={currency}
        caption={caption}
      />
      <StatCard
        size="sm"
        label="Balance"
        value={totals.balance}
        previous={previous?.balance}
        trend="higher-is-better"
        currency={currency}
        caption={caption}
      />
    </div>
  )
}

/** Las tres KPI mientras cargan, con el mismo contenedor y alturas */
export function TransactionsTotalsSkeleton({
  caption = false
}: {
  /** Reserva la línea del alcance bajo la cifra */
  caption?: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCardSkeleton
        size="sm"
        caption={caption}
      />
      <StatCardSkeleton
        size="sm"
        caption={caption}
      />
      <StatCardSkeleton
        size="sm"
        caption={caption}
      />
    </div>
  )
}
