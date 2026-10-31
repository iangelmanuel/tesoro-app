import type { Route } from "next"
import Link from "next/link"
import { FileUp, Plus, ReceiptText, SearchX } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Button } from "@/components/ui/button"
import type { AccountOption } from "@/features/accounts/components/account-select"
import type { Category } from "@/features/categories/queries"
import { IMPORT_PATH } from "@/features/imports/constants"
import type { WorkspaceType } from "@/features/workspaces/queries"
import {
  TRANSACTIONS_PATH,
  type TransactionFilters,
  buildFiltersQuery
} from "../filters"
import { TransactionDialog } from "./transaction-dialog"

export function NoTransactions({
  workspaceId,
  workspaceType = "personal",
  categories,
  accounts
}: {
  workspaceId: string
  /** Empresa no tiene importar */
  workspaceType?: WorkspaceType
  categories: Category[]
  accounts: AccountOption[]
}) {
  const isBusiness = workspaceType === "business"

  return (
    <EmptyState
      icon={ReceiptText}
      title="Registra tu primer movimiento"
      description={
        isBusiness
          ? "Anota una venta o un costo o gasto de tu empresa. Con tus movimientos Tesoro arma las ventas, los costos y la utilidad del mes."
          : "Anota un ingreso o un gasto, o importa los que ya tienes en un Excel o CSV. Con tus movimientos Tesoro arma tus totales, gráficas y recomendaciones."
      }
    >
      <div className="flex flex-wrap justify-center gap-2">
        <TransactionDialog
          workspaceId={workspaceId}
          workspaceType={workspaceType}
          categories={categories}
          accounts={accounts}
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Nuevo movimiento
            </Button>
          }
        />
        {!isBusiness && (
          <Button
            variant="outline"
            asChild
          >
            <Link href={IMPORT_PATH}>
              <FileUp data-icon="inline-start" />
              Importar
            </Link>
          </Button>
        )}
      </div>
    </EmptyState>
  )
}

// Si hay filtros de tipo, categoría, cuenta o texto se limpian esos y se
// conserva el mes. Si solo filtra el mes, el enlace abre todos los meses.
export function NoFilteredTransactions({
  path = TRANSACTIONS_PATH,
  filters
}: {
  /** Ruta de Movimientos del espacio */
  path?: string
  filters: TransactionFilters
}) {
  const hasExtraFilters = Boolean(
    filters.type || filters.categoryId || filters.accountId || filters.q
  )
  const query = hasExtraFilters
    ? buildFiltersQuery({ month: filters.month, page: 1 })
    : buildFiltersQuery({ month: "all", page: 1 })

  return (
    <EmptyState
      icon={SearchX}
      title="No hay movimientos con estos filtros"
      description="Prueba con otro mes, tipo, categoría, cuenta o texto."
    >
      <Button
        variant="outline"
        asChild
      >
        <Link href={`${path}?${query}` as Route}>
          {hasExtraFilters ? "Limpiar filtros" : "Ver todos los meses"}
        </Link>
      </Button>
    </EmptyState>
  )
}
