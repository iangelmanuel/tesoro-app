import type { Route } from "next"
import Link from "next/link"
import { Plus, ReceiptText, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Category } from "@/features/categories/queries"
import {
  TRANSACTIONS_PATH,
  type TransactionFilters,
  buildFiltersQuery
} from "../filters"
import { TransactionDialog } from "./transaction-dialog"

function EmptyState({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  )
}

export function NoTransactions({ categories }: { categories: Category[] }) {
  return (
    <EmptyState
      icon={ReceiptText}
      title="Registra tu primer movimiento"
      description="Anota un ingreso o un gasto. Con tus movimientos Tesoro arma tus totales, gráficas y recomendaciones."
    >
      <TransactionDialog
        categories={categories}
        trigger={
          <Button>
            <Plus data-icon="inline-start" />
            Nuevo movimiento
          </Button>
        }
      />
    </EmptyState>
  )
}

// Si hay filtros de tipo, categoría o texto se limpian esos y se conserva el
// mes. Si solo filtra el mes, el enlace abre todos los meses.
export function NoFilteredTransactions({
  filters
}: {
  filters: TransactionFilters
}) {
  const hasExtraFilters = Boolean(
    filters.type || filters.categoryId || filters.q
  )
  const query = hasExtraFilters
    ? buildFiltersQuery({ month: filters.month, page: 1 })
    : buildFiltersQuery({ month: "all", page: 1 })

  return (
    <EmptyState
      icon={SearchX}
      title="No hay movimientos con estos filtros"
      description="Prueba con otro mes, tipo, categoría o texto."
    >
      <Button
        variant="outline"
        asChild
      >
        <Link href={`${TRANSACTIONS_PATH}?${query}` as Route}>
          {hasExtraFilters ? "Limpiar filtros" : "Ver todos los meses"}
        </Link>
      </Button>
    </EmptyState>
  )
}
