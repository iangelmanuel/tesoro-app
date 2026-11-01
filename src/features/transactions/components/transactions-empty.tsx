import type { Route } from "next"
import Link from "next/link"
import { Button, buttonVariants } from "@heroui/react"
import { FileUp, Plus, ReceiptText, SearchX } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
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
  accounts: PaymentAccountOption[]
}) {
  const isBusiness = workspaceType === "business"

  return (
    <EmptyState
      icon={ReceiptText}
      title={
        isBusiness
          ? "Registra tu primera venta"
          : "Registra tu primer movimiento"
      }
      description={
        isBusiness
          ? "Anota una venta o un costo o gasto de tu empresa."
          : "Anota un ingreso o un gasto, o importa los que ya tienes en un Excel o CSV."
      }
    >
      <>
        <TransactionDialog
          workspaceId={workspaceId}
          workspaceType={workspaceType}
          categories={categories}
          accounts={accounts}
          trigger={
            <Button>
              <Plus />
              {isBusiness ? "Registrar operación" : "Registrar movimiento"}
            </Button>
          }
        />
        {!isBusiness && (
          <Link
            href={IMPORT_PATH}
            className={buttonVariants({ variant: "secondary" })}
          >
            <FileUp className="size-4" />
            Importar
          </Link>
        )}
      </>
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
      <Link
        href={`${path}?${query}` as Route}
        className={buttonVariants({ variant: "secondary" })}
      >
        {hasExtraFilters ? "Limpiar filtros" : "Ver todos los meses"}
      </Link>
    </EmptyState>
  )
}
