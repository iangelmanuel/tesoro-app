"use client"

import { Suspense, useEffect, useState } from "react"
import {
  ScrollTable,
  ScrollTableSkeleton
} from "@/components/dashboard/data/scroll-table"
import { SURFACE_LIST } from "@/components/dashboard/data/surface"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import { cn } from "@/libs/cn"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { isAccountMovement } from "../ledger-rows"
import type { LedgerEntry } from "../types"
import {
  AccountMovementRow,
  AdjustmentRow,
  TransferRow
} from "./transactions-table-account-rows"
import {
  TableDndContext,
  createRowElementsStore
} from "./transactions-table-dnd-context"
import { TransactionRow } from "./transactions-table-row"
import { useTransactionsTable } from "./use-transactions-table"

interface TransactionsTableProps {
  workspaceId: string
  /** En Empresa se muestran cliente/proveedor y factura */
  workspaceType?: WorkspaceType
  rows: LedgerEntry[]
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: PaymentAccountOption[]
  currency: string
  /** Muestra ↑/↓ para reordenar dentro del día: con permiso de escritura y sin búsqueda */
  canReorder?: boolean
  /** Ingresos fijos activos para el select del tab Ingreso (solo Personal) */
  incomeSources?: IncomeSourceOption[]
}

// En móvil la tabla se muestra completa y se desliza en horizontal: las
// celdas no se parten en varias líneas (TableCell ya es whitespace-nowrap),
// salvo la descripción y el cliente o proveedor
const ACTIONS_COLUMN = "w-28 md:w-16"
// La tabla en su superficie: sin borde, con las filas a la vista
const TABLE_SURFACE = cn(SURFACE_LIST, "divide-y-0 px-2")
const MIN_WIDTH = { personal: "46rem", business: "64rem" } as const

const TableDnd = lazyWithPreload(() =>
  import("./transactions-table-dnd").then((m) => m.TableDnd)
)

// Una sola descarga por sesión: al volver a Movimientos ya está
let dndLoaded = false

/**
 * @dnd-kit en idle después de hidratar (SPEC 56b): nadie reordena en el
 * primer segundo. Sin requestIdleCallback (Safari), un setTimeout corto. Si
 * falla la red, el asa sigue disabled y la próxima visita lo reintenta
 */
function useIdleTableDnd(enabled: boolean) {
  const [ready, setReady] = useState(dndLoaded)

  useEffect(() => {
    if (!enabled || ready) return
    let cancelled = false
    const load = () => {
      void TableDnd.preload().then((loaded) => {
        dndLoaded = loaded
        if (loaded && !cancelled) setReady(true)
      })
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 2000 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }
    const id = window.setTimeout(load, 200)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [enabled, ready])

  return ready
}

// Client: cada fila abre el diálogo de edición, y así las categorías y las
// cuentas viajan una sola vez en vez de una por fila
export function TransactionsTable({
  workspaceId,
  workspaceType = "personal",
  rows,
  categories,
  accounts,
  currency,
  canReorder = false,
  incomeSources
}: TransactionsTableProps) {
  const { orderedRows, reorders, activeId, handleDragStart, handleDragEnd } =
    useTransactionsTable(workspaceId, rows, canReorder)
  const dndReady = useIdleTableDnd(canReorder)
  const [rowElements] = useState(createRowElementsStore)
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const accountName = (id: string) => accountsById.get(id)?.name ?? "Cuenta"
  const isBusiness = workspaceType === "business"

  return (
    <TableDndContext
      value={{ ready: dndReady, activeId, register: rowElements.register }}
    >
      <ScrollTable
        minWidth={MIN_WIDTH[workspaceType]}
        tour="transactions-table"
        className={TABLE_SURFACE}
      >
        <Table
          aria-label="Movimientos"
          className="[&_tbody_td]:py-2.5 motion-reduce:[&_tbody_tr]:transition-none"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canReorder ? (
                <TableHead className="w-7 ps-2 pe-0">
                  <span className="sr-only">Orden</span>
                </TableHead>
              ) : null}
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              {isBusiness ? <TableHead>Cliente o proveedor</TableHead> : null}
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-end">Monto</TableHead>
              <TableHead className={ACTIONS_COLUMN}>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedRows.map((row, index) => {
              if (row.kind === "transfer") {
                return (
                  <TransferRow
                    key={row.id}
                    workspaceId={workspaceId}
                    showCounterparty={isBusiness}
                    transfer={row}
                    reorder={reorders?.[index]}
                    label={`${accountName(row.from_account_id)} → ${accountName(row.to_account_id)}`}
                    accounts={accounts}
                    currency={currency}
                  />
                )
              }
              if (isAccountMovement(row)) {
                return (
                  <AccountMovementRow
                    key={row.id}
                    workspaceId={workspaceId}
                    showCounterparty={isBusiness}
                    entry={row}
                    reorder={reorders?.[index]}
                    account={accountsById.get(row.account_id)}
                    accounts={accounts}
                    categories={categories}
                    currency={currency}
                  />
                )
              }
              if (row.kind === "adjustment") {
                return (
                  <AdjustmentRow
                    key={row.id}
                    workspaceId={workspaceId}
                    showCounterparty={isBusiness}
                    adjustment={row}
                    reorder={reorders?.[index]}
                    label={`Ajuste de saldo · ${accountName(row.account_id)}`}
                    currency={currency}
                  />
                )
              }

              const transaction = row.transaction
              return (
                <TransactionRow
                  key={transaction.id}
                  workspaceId={workspaceId}
                  workspaceType={workspaceType}
                  row={row}
                  reorder={reorders?.[index]}
                  category={categoriesById.get(transaction.category_id)}
                  account={
                    transaction.account_id
                      ? accountsById.get(transaction.account_id)
                      : undefined
                  }
                  categories={categories}
                  accounts={accounts}
                  currency={currency}
                  incomeSources={incomeSources}
                />
              )
            })}
          </TableBody>
        </Table>
      </ScrollTable>
      {/* Al lado de la tabla: llegar no remonta las filas */}
      {dndReady && reorders ? (
        <Suspense fallback={null}>
          <TableDnd.Component
            reorders={reorders}
            elementsFor={rowElements.elementsFor}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        </Suspense>
      ) : null}
    </TableDndContext>
  )
}

/**
 * La tabla mientras carga, con la misma superficie, cabecera y filas. En
 * Empresa suma la columna de cliente o proveedor
 */
export function TransactionsTableSkeleton({
  workspaceType = "personal",
  rows = 8
}: {
  workspaceType?: WorkspaceType
  rows?: number
}) {
  return (
    <ScrollTableSkeleton
      columns={workspaceType === "business" ? 7 : 6}
      rows={rows}
      minWidth={MIN_WIDTH[workspaceType]}
      amountColumn={false}
    />
  )
}
