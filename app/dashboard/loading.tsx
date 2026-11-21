import { ChartCardSkeleton } from "@/components/charts/chart-card"
import { ScrollTableSkeleton } from "@/components/dashboard/data/scroll-table"
import { StatCardSkeleton } from "@/components/dashboard/data/stat-card"
import { LoadingRegion } from "@/components/ui/skeleton"

// Carga de cualquier pantalla del dashboard que no tenga su propio
// loading.tsx: la forma general de una pantalla (tres KPIs, una gráfica y
// una tabla) con los skeletons de cada componente. Cada ruta compone el suyo
// (SPEC 52 y 53)
export default function DashboardLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 sm:grid-cols-3 md:gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <ChartCardSkeleton chartClassName="aspect-auto h-64" />
      <ScrollTableSkeleton />
    </LoadingRegion>
  )
}
