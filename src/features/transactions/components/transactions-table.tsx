"use client"

import { useId, useOptimistic, useState, useTransition } from "react"
import {
  DragDropProvider,
  type DragEndEvent,
  DragOverlay
} from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import {
  ArrowLeftRight,
  Banknote,
  Copy,
  CreditCard,
  GripVertical,
  Pencil,
  PiggyBank,
  RefreshCw,
  Trash2
} from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import {
  type RowAction,
  RowActions,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/row-actions"
import {
  ScrollTable,
  ScrollTableSkeleton
} from "@/components/dashboard/scroll-table"
import { SURFACE_LIST } from "@/components/dashboard/surface"
import { toast } from "@/components/ui/sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { deleteAdjustment, deleteTransfer } from "@/features/accounts/actions"
import { activeAccountId } from "@/features/accounts/active-account"
import { AccountLabel } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { deleteEntry } from "@/features/debts/actions"
import { DebtEntryDialog } from "@/features/debts/components/debt-entry-dialog"
import {
  DuplicateDebtEntryLoader,
  DuplicateReceivableLoader
} from "@/features/debts/components/duplicate-debt-entry-dialog"
import { deleteContribution } from "@/features/goals/actions"
import { ContributionDialog } from "@/features/goals/components/contribution-dialog"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import { cn } from "@/libs/cn"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import { deleteTransaction, moveLedgerEntry } from "../actions"
import {
  type AccountMovementKind,
  type LedgerEntry,
  type LinkedDebtEntry
} from "../queries"
import { DuplicateTransactionDialog } from "./duplicate-transaction-dialog"
import { TransactionDialog } from "./transaction-dialog"

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

/** Reordenar una fila dentro de su día arrastrando su asa (⋮⋮) */
interface Reorder {
  /** Llave de la fila: `kind:id` */
  id: string
  day: string
  /** Posición de la fila entre las de su mismo día a la vista */
  index: number
  /** Hay otra fila de su día a la vista: sin ella no hay nada que reordenar */
  canDrag: boolean
  /** Texto de la fila para la vista previa del arrastre */
  title: string
  /** Resaltado mientras se arrastra otra fila */
  className?: string
}

// El id de la fila en su tabla de origen (el mismo que usa move_ledger_entry)
function entryId(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.id : row.id
}

function entryDate(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.occurred_on : row.occurred_on
}

function rowKey(row: LedgerEntry) {
  return `${row.kind}:${entryId(row)}`
}

// Texto corto de la fila para la vista previa del arrastre
function rowTitle(row: LedgerEntry) {
  if ("transaction" in row) {
    return row.transaction.description
  }
  switch (row.kind) {
    case "transfer":
      return "Traspaso"
    case "adjustment":
      return "Ajuste de saldo"
    default:
      return describeAccountMovement(row).title
  }
}

// La fila origen toma el lugar de la destino: sube antes de ella, baja después
function reorderRows(
  current: LedgerEntry[],
  move: { sourceKey: string; targetKey: string }
) {
  const from = current.findIndex((row) => rowKey(row) === move.sourceKey)
  const to = current.findIndex((row) => rowKey(row) === move.targetKey)

  if (from === -1 || to === -1) {
    return current
  }

  const next = [...current]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

type TransactionEntry = Extract<LedgerEntry, { transaction: unknown }>
type TransferEntry = Extract<LedgerEntry, { kind: "transfer" }>
type AdjustmentEntry = Extract<LedgerEntry, { kind: "adjustment" }>
type AccountMovementEntry = Extract<LedgerEntry, { kind: AccountMovementKind }>

// Pagos, avances y aportes con cuenta: el texto de la fila y si el saldo de la
// cuenta sube (+) o baja (−). Un retiro de meta (monto < 0) entra a la cuenta.
function describeAccountMovement(entry: AccountMovementEntry) {
  switch (entry.kind) {
    case "debt_payment":
      return {
        title: `${entry.is_extra_payment ? "Abono" : "Pago"} · ${entry.name}`,
        type: entry.is_extra_payment ? "Abono a tarjeta" : "Pago de tarjeta",
        icon: CreditCard,
        increases: false
      }
    case "debt_advance":
      return {
        title: `Avance · ${entry.name}`,
        type: "Avance de tarjeta",
        icon: Banknote,
        increases: true
      }
    case "goal_contribution":
      return entry.amount < 0
        ? {
            title: `Retiro · ${entry.name}`,
            type: "Retiro de meta",
            icon: PiggyBank,
            increases: true
          }
        : {
            title: `Aporte · ${entry.name}`,
            type: "Aporte a meta",
            icon: PiggyBank,
            increases: false
          }
  }
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
  // La fila se mueve al instante; si la action falla, vuelve a su lugar
  const [orderedRows, moveOptimistic] = useOptimistic(rows, reorderRows)
  const [, startTransition] = useTransition()
  // Día de la fila que se arrastra: solo se puede soltar dentro de él
  const [draggingDay, setDraggingDay] = useState<string | null>(null)
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const accountName = (id: string) => accountsById.get(id)?.name ?? "Cuenta"
  const isBusiness = workspaceType === "business"

  function moveRow(source: LedgerEntry, target: LedgerEntry) {
    startTransition(async () => {
      moveOptimistic({ sourceKey: rowKey(source), targetKey: rowKey(target) })
      const result = await moveLedgerEntry(
        workspaceId,
        source.kind,
        entryId(source),
        target.kind,
        entryId(target)
      )
      if (result.error) {
        toast.error(result.error)
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingDay(null)
    const source = event.operation.source

    if (event.canceled || !isSortable(source)) {
      return
    }
    // Una fila solo se mueve entre las de su día, y la RPC deja la fila
    // arrastrada en el lugar de la destino
    if (
      source.group !== source.initialGroup ||
      source.index === source.initialIndex
    ) {
      return
    }
    const dayRows = orderedRows.filter(
      (row) => entryDate(row) === String(source.group)
    )
    const moved = dayRows[source.initialIndex]
    const destination = dayRows[source.index]

    if (moved && destination) {
      moveRow(moved, destination)
    }
  }

  // Las filas del mismo día se resaltan como zona de soltado; el resto se
  // atenúa mientras se arrastra
  function dragClassName(day: string) {
    if (!draggingDay) {
      return undefined
    }
    return day === draggingDay ? "bg-primary/10" : "opacity-40"
  }

  // Posición de cada fila entre las de su día, para el orden de dnd-kit
  const dayCounts = new Map<string, number>()

  // Un día de una sola fila a la vista no tiene asa
  function reorderFor(index: number): Reorder | undefined {
    if (!canReorder) {
      return undefined
    }
    const row = orderedRows[index]
    const day = entryDate(row)
    const previous = orderedRows[index - 1]
    const next = orderedRows[index + 1]
    const dayIndex = dayCounts.get(day) ?? 0
    dayCounts.set(day, dayIndex + 1)

    return {
      id: rowKey(row),
      day,
      index: dayIndex,
      canDrag: Boolean(
        (previous && entryDate(previous) === day) ||
        (next && entryDate(next) === day)
      ),
      title: rowTitle(row),
      className: dragClassName(day)
    }
  }

  return (
    <DragDropProvider
      onDragStart={(event) => {
        const source = event.operation.source
        setDraggingDay(isSortable(source) ? String(source.group) : null)
      }}
      onDragEnd={handleDragEnd}
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
                    reorder={reorderFor(index)}
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
                    reorder={reorderFor(index)}
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
                    reorder={reorderFor(index)}
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
                  reorder={reorderFor(index)}
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
      <DragOverlay>
        {(source) => (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl bg-popover px-4 py-2.5 text-sm font-medium shadow-(--overlay-shadow) ring-1 ring-ring">
            <GripVertical
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {String(source.data?.title ?? "")}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
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

// Movimiento suelto (entrada o salida), o el de un pago enlazado a una deuda
function TransactionRow({
  workspaceId,
  workspaceType,
  row,
  reorder,
  category,
  account,
  categories,
  accounts,
  currency,
  incomeSources
}: {
  workspaceId: string
  workspaceType: WorkspaceType
  row: TransactionEntry
  reorder: Reorder | undefined
  category: Category | undefined
  account: PaymentAccountOption | undefined
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
  incomeSources?: IncomeSourceOption[]
}) {
  const transaction = row.transaction
  const isIncome = transaction.type === "income"
  const entry: EntryConfig = row.debt_entry
    ? linkedPaymentEntry({
        label: transaction.description,
        entry: row.debt_entry,
        accounts,
        categories,
        currency
      })
    : {
        label: transaction.description,
        remove: {
          title: "¿Eliminar este movimiento?",
          success: "Movimiento eliminado",
          onDelete: () => deleteTransaction(workspaceId, transaction.id)
        },
        renderEdit: (dialog) => (
          <TransactionDialog
            workspaceId={workspaceId}
            workspaceType={workspaceType}
            categories={categories}
            accounts={accounts}
            transaction={transaction}
            incomeSources={incomeSources}
            open={dialog.open}
            onOpenChange={dialog.onOpenChange}
          />
        ),
        renderDuplicate: (dialog) =>
          dialog.open && (
            <DuplicateTransactionDialog
              workspaceId={workspaceId}
              workspaceType={workspaceType}
              transactionId={transaction.id}
              categories={categories}
              accounts={accounts}
              incomeSources={incomeSources}
              onOpenChange={dialog.onOpenChange}
            />
          )
      }

  return (
    <SortableRow
      reorder={reorder}
      entry={entry}
    >
      <DateCell
        date={transaction.occurred_on}
        time={row.occurred_time}
      />
      <DescriptionCell
        title={transaction.description}
        note={transaction.note}
        // Ingreso de un avance de tarjeta (SPEC 36)
        icon={row.debt_entry?.kind === "advance" ? Banknote : undefined}
      />
      <TableCell>
        {category && (
          <CategoryBadge
            name={category.name}
            icon={category.icon}
            color={category.color}
          />
        )}
      </TableCell>
      {workspaceType === "business" && (
        <CounterpartyCell
          counterparty={transaction.counterparty}
          invoiceRef={transaction.invoice_ref}
        />
      )}
      <TableCell>
        {account ? (
          <AccountLabel account={account} />
        ) : (
          <span className="text-muted-foreground">Sin cuenta</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-end font-medium tabular-nums",
          isIncome ? "text-(--income)" : "text-(--expense)"
        )}
      >
        {/* El signo se lee: "más" o "menos" antes del monto completo */}
        <span aria-hidden="true">{isIncome ? "+" : "−"}</span>
        <span className="sr-only">{isIncome ? "más " : "menos "}</span>
        {formatCurrency(transaction.amount, currency)}
      </TableCell>
    </SortableRow>
  )
}

// Cliente o proveedor y, debajo, el número de factura
function CounterpartyCell({
  counterparty,
  invoiceRef
}: {
  counterparty: string | null
  invoiceRef: string | null
}) {
  if (!counterparty && !invoiceRef) {
    return (
      <TableCell>
        <span className="text-muted-foreground">—</span>
      </TableCell>
    )
  }
  return (
    <TableCell className="max-w-48 whitespace-normal">
      {counterparty && <p className="truncate">{counterparty}</p>}
      {invoiceRef && (
        <p className="truncate text-sm text-muted-foreground">{invoiceRef}</p>
      )}
    </TableCell>
  )
}

// Fila ordenable con dnd-kit: el asa (⋮⋮) a la izquierda inicia el arrastre
// con mouse, dedo (mantener presionado) o teclado. Sin `reorder` la tabla no
// se puede reordenar (búsqueda activa o sin permiso de escritura). La fila
// entera lleva el menú contextual (clic derecho y pulsación larga) con las
// mismas acciones que su botón ⋯; el asa no lo abre, así arrastrar y la
// pulsación larga no chocan
function SortableRow({
  reorder,
  entry,
  children
}: {
  reorder: Reorder | undefined
  entry: EntryConfig
  children: React.ReactNode
}) {
  const fallbackId = useId()
  const { ref, handleRef, isDragging, isDragSource } = useSortable({
    id: reorder?.id ?? fallbackId,
    index: reorder?.index ?? 0,
    // Grupo y tipo por día: una fila nunca interactúa con las de otro día
    group: reorder?.day,
    type: reorder?.day ?? fallbackId,
    accept: reorder?.day ? [reorder.day] : undefined,
    data: { title: reorder?.title },
    disabled: !reorder?.canDrag
  })
  const { actions, dialogs } = useEntryActions(entry)

  return (
    <RowContextMenu
      label={entry.label}
      actions={actions}
    >
      <TableRow
        // Solo una fila arrastrable se registra en el <tr>. Deshabilitada,
        // dnd-kit le pone aria-disabled="true": el menú de acciones debe
        // seguir alcanzable en las filas solas en su día (SPEC 26)
        ref={reorder?.canDrag ? ref : undefined}
        className={cn(
          "duration-150",
          reorder?.className,
          // La fila original queda como hueco en el lugar de destino
          isDragSource && "bg-primary/15 opacity-50"
        )}
      >
        {reorder ? (
          <TableCell className="ps-2 pe-0">
            {reorder.canDrag ? (
              <button
                ref={handleRef}
                type="button"
                aria-label="Reordenar dentro del día"
                data-tour="transactions-reorder"
                // El asa es solo para arrastrar: ni la pulsación larga ni el
                // clic derecho abren el menú de la fila desde aquí
                onTouchStart={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.stopPropagation()}
                className={cn(
                  "grid h-6 w-5 touch-none place-items-center rounded-md text-muted-foreground/70 outline-none select-none hover:bg-highlight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11 pointer-coarse:w-7",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-4"
                />
              </button>
            ) : null}
          </TableCell>
        ) : null}
        {children}
        <TableCell>
          <RowActions
            label={entry.label}
            actions={actions}
          />
          <RowMenuBoundary>{dialogs}</RowMenuBoundary>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  )
}

// Fecha y, debajo, la hora si el usuario la puso
function DateCell({ date, time }: { date: string; time: string | null }) {
  return (
    <TableCell className="text-muted-foreground">
      {formatDate(date)}
      {time && <span className="block text-xs">{formatTime(time)}</span>}
    </TableCell>
  )
}

function DescriptionCell({
  title,
  note,
  icon: Icon
}: {
  title: string
  note: string | null
  icon?: React.ComponentType<{ className?: string }>
}) {
  // Sin truncar a una línea: el texto envuelve (máximo 3 líneas) y el
  // completo queda en `title` y en el diálogo de edición
  return (
    <TableCell className="max-w-72 min-w-56 whitespace-normal">
      <p
        title={title}
        className="flex items-start gap-2 font-medium"
      >
        {Icon && (
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="line-clamp-3 min-w-0 break-words">{title}</span>
      </p>
      {note && (
        <p
          title={note}
          className="line-clamp-3 text-xs break-words text-muted-foreground"
        >
          {note}
        </p>
      )}
    </TableCell>
  )
}

// Monto neutro (traspasos, ajustes, pagos con cuenta): gris, con el signo
// leído como "más" o "menos" cuando lo hay
function NeutralAmountCell({
  sign,
  amount,
  currency
}: {
  sign: "+" | "−" | null
  amount: number
  currency: string
}) {
  return (
    <TableCell className="text-end font-medium text-muted-foreground tabular-nums">
      {sign ? (
        <>
          <span aria-hidden="true">{sign}</span>
          <span className="sr-only">{sign === "+" ? "más " : "menos "}</span>
        </>
      ) : null}
      {formatCurrency(amount, currency)}
    </TableCell>
  )
}

// Traspaso: neutro, sin signo y sin categoría. No suma a los totales.
function TransferRow({
  workspaceId,
  showCounterparty,
  transfer,
  label,
  accounts,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  transfer: TransferEntry
  label: string
  accounts: PaymentAccountOption[]
  currency: string
  reorder: Reorder | undefined
}) {
  const entry: EntryConfig = {
    label: `Traspaso ${label}`,
    remove: {
      title: "¿Eliminar este traspaso?",
      success: "Traspaso eliminado",
      onDelete: () => deleteTransfer(workspaceId, transfer.id)
    },
    renderEdit: (dialog) => (
      <TransferDialog
        workspaceId={workspaceId}
        accounts={accounts}
        transfer={transfer}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
      />
    ),
    renderDuplicate: (dialog) =>
      dialog.open && (
        <TransferDialog
          workspaceId={workspaceId}
          accounts={accounts}
          // Mismas cuentas (si siguen activas), monto y nota; fecha de
          // hoy y hora vacía (SPEC 49)
          initialValues={{
            from_account_id: activeAccountId(
              accounts,
              transfer.from_account_id
            ),
            to_account_id: activeAccountId(accounts, transfer.to_account_id),
            amount: transfer.amount,
            note: transfer.note ?? ""
          }}
          open
          onOpenChange={dialog.onOpenChange}
        />
      )
  }

  return (
    <SortableRow
      reorder={reorder}
      entry={entry}
    >
      <DateCell
        date={transfer.occurred_on}
        time={transfer.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={transfer.note}
        icon={ArrowLeftRight}
      />
      <TableCell className="text-muted-foreground">Traspaso</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell />
      <NeutralAmountCell
        sign={null}
        amount={transfer.amount}
        currency={currency}
      />
    </SortableRow>
  )
}

function isAccountMovement(row: LedgerEntry): row is AccountMovementEntry {
  return (
    row.kind === "debt_payment" ||
    row.kind === "debt_advance" ||
    row.kind === "goal_contribution"
  )
}

// Pago de tarjeta, avance o aporte con cuenta: gris, con signo según el saldo
// de la cuenta. No suma a los totales. Se edita y elimina con el diálogo y
// las actions de la deuda o la meta (SPEC 26), que recalculan su saldo. Un
// avance con cuenta ya es un ingreso (SPEC 36): aquí solo llegan los antiguos
// que la migración no pudo convertir.
function AccountMovementRow({
  workspaceId,
  showCounterparty,
  entry,
  account,
  accounts,
  categories,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  entry: AccountMovementEntry
  account: PaymentAccountOption | undefined
  /** Cuentas y categorías del editor del movimiento de la deuda (SPEC 42) */
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
  reorder: Reorder | undefined
}) {
  const { title, type, icon, increases } = describeAccountMovement(entry)

  const config: EntryConfig =
    entry.kind === "goal_contribution"
      ? {
          label: title,
          remove: {
            title: `¿Eliminar este ${type.toLowerCase()}?`,
            success: `${entry.amount < 0 ? "Retiro" : "Aporte"} eliminado`,
            onDelete: () => deleteContribution(entry.id)
          },
          renderEdit: (dialog) => (
            <ContributionDialog
              workspaceId={workspaceId}
              goalId={entry.parent_id}
              contribution={{
                id: entry.id,
                amount: entry.amount,
                occurred_on: entry.occurred_on,
                occurred_time: entry.occurred_time,
                note: entry.note
              }}
              open={dialog.open}
              onOpenChange={dialog.onOpenChange}
            />
          ),
          renderDuplicate:
            // Solo con la meta activa: cumplida o archivada no recibe aportes
            entry.parent_active
              ? (dialog) =>
                  dialog.open && (
                    <ContributionDialog
                      workspaceId={workspaceId}
                      goalId={entry.parent_id}
                      kind={entry.amount < 0 ? "withdrawal" : "deposit"}
                      accounts={accounts}
                      initialValues={{
                        amount: Math.abs(entry.amount),
                        account_id: activeAccountId(accounts, entry.account_id),
                        note: entry.note ?? ""
                      }}
                      open
                      onOpenChange={dialog.onOpenChange}
                    />
                  )
              : undefined
        }
      : {
          label: title,
          remove: {
            title: `¿Eliminar este ${type.toLowerCase()}?`,
            success: `${entry.kind === "debt_advance" ? "Avance" : entry.is_extra_payment ? "Abono" : "Pago"} eliminado`,
            onDelete: () => deleteEntry(entry.id)
          },
          renderEdit: (dialog) =>
            // El mismo editor que el Sheet de la deuda (SPEC 42)
            dialog.open && (
              <DebtEntryDialog
                workspaceId={workspaceId}
                entryId={entry.id}
                accounts={accounts}
                categories={categories}
                currency={currency}
                open
                onOpenChange={dialog.onOpenChange}
              />
            ),
          renderDuplicate:
            // Pago o avance antiguo de tarjeta: solo con la deuda activa
            entry.parent_active
              ? (dialog) =>
                  dialog.open && (
                    <DuplicateDebtEntryLoader
                      workspaceId={workspaceId}
                      entryId={entry.id}
                      accounts={accounts}
                      onOpenChange={dialog.onOpenChange}
                    />
                  )
              : undefined
        }

  return (
    <SortableRow
      reorder={reorder}
      entry={config}
    >
      <DateCell
        date={entry.occurred_on}
        time={entry.occurred_time}
      />
      <DescriptionCell
        title={title}
        note={entry.note}
        icon={icon}
      />
      <TableCell className="text-muted-foreground">{type}</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell>{account && <AccountLabel account={account} />}</TableCell>
      <NeutralAmountCell
        sign={increases ? "+" : "−"}
        amount={Math.abs(entry.amount)}
        currency={currency}
      />
    </SortableRow>
  )
}

// Movimiento de un pago de préstamo, un cobro de Me deben (SPEC 26) o un
// avance de tarjeta (SPEC 36). El abono es la fuente de verdad: se edita con
// su diálogo y el trigger copia monto, fecha y hora al movimiento; eliminarlo
// borra los dos juntos.
function linkedPaymentEntry({
  label,
  entry,
  accounts,
  categories,
  currency
}: {
  label: string
  entry: LinkedDebtEntry
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
}): EntryConfig {
  const noun =
    entry.kind === "advance"
      ? "avance"
      : entry.debt_kind === "receivable"
        ? "cobro"
        : "pago"

  return {
    label,
    remove: {
      title: `¿Eliminar este ${noun}?`,
      success: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} eliminado`,
      onDelete: () => deleteEntry(entry.id)
    },
    renderEdit: (dialog) =>
      // El mismo editor que el Sheet de la deuda (SPEC 42)
      dialog.open && (
        <DebtEntryDialog
          workspaceId={entry.workspace_id}
          entryId={entry.id}
          accounts={accounts}
          categories={categories}
          currency={currency}
          open
          onOpenChange={dialog.onOpenChange}
        />
      ),
    renderDuplicate:
      // Solo con la deuda activa. El cobro de un Me deben mensual va por su
      // diálogo, a la cuota pendiente siguiente (toast si no queda)
      entry.debt_status === "active"
        ? (dialog) =>
            dialog.open &&
            (entry.debt_kind === "receivable" &&
            entry.debt_schedule === "monthly" ? (
              <DuplicateReceivableLoader
                workspaceId={entry.workspace_id}
                entryId={entry.id}
                accounts={accounts}
                onOpenChange={dialog.onOpenChange}
              />
            ) : (
              <DuplicateDebtEntryLoader
                workspaceId={entry.workspace_id}
                entryId={entry.id}
                accounts={accounts}
                onOpenChange={dialog.onOpenChange}
              />
            ))
        : undefined
  }
}

// Ajuste de saldo: neutro, con signo. Solo se elimina.
function AdjustmentRow({
  workspaceId,
  showCounterparty,
  adjustment,
  label,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  adjustment: AdjustmentEntry
  label: string
  currency: string
  reorder: Reorder | undefined
}) {
  const entry: EntryConfig = {
    label,
    remove: {
      title: "¿Eliminar este ajuste?",
      success: "Ajuste eliminado",
      onDelete: () => deleteAdjustment(workspaceId, adjustment.id)
    }
  }

  return (
    <SortableRow
      reorder={reorder}
      entry={entry}
    >
      <DateCell
        date={adjustment.occurred_on}
        time={adjustment.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={adjustment.note}
        icon={RefreshCw}
      />
      <TableCell className="text-muted-foreground">Ajuste</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell />
      <NeutralAmountCell
        sign={adjustment.amount > 0 ? "+" : "−"}
        amount={Math.abs(adjustment.amount)}
        currency={currency}
      />
    </SortableRow>
  )
}

interface RemoveConfig {
  title: string
  success: string
  onDelete: () => Promise<{ error?: string }>
}

interface RowDialogControl {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Acciones de una fila: Editar y Duplicar (si hay diálogo) y Eliminar */
interface EntryConfig {
  /** Nombre de la fila para los avisos y los menús */
  label: string
  remove: RemoveConfig
  renderEdit?: (dialog: RowDialogControl) => React.ReactNode
  /** Diálogo de crear prellenado con los datos de la fila (SPEC 49) */
  renderDuplicate?: (dialog: RowDialogControl) => React.ReactNode
}

// La misma lista sirve al botón ⋯ (o los botones en línea en el teléfono) y
// al menú contextual de la fila. Los diálogos se controlan desde aquí porque
// los menús no pueden alojar triggers
function useEntryActions({
  label,
  remove,
  renderEdit,
  renderDuplicate
}: EntryConfig) {
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const actions: RowAction[] = [
    ...(renderEdit
      ? [
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil />,
            onAction: () => setEditing(true)
          }
        ]
      : []),
    ...(renderDuplicate
      ? [
          {
            id: "duplicate",
            label: "Duplicar",
            icon: <Copy />,
            onAction: () => setDuplicating(true)
          }
        ]
      : []),
    {
      id: "delete",
      label: "Eliminar",
      icon: <Trash2 />,
      destructive: true,
      onAction: () => setDeleting(true)
    }
  ]

  const dialogs = (
    <>
      {renderEdit?.({ open: editing, onOpenChange: setEditing })}
      {renderDuplicate?.({ open: duplicating, onOpenChange: setDuplicating })}
      <DeleteEntryDialog
        label={label}
        {...remove}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </>
  )

  return { actions, dialogs }
}

function DeleteEntryDialog({
  label,
  title,
  success,
  onDelete,
  open,
  onOpenChange
}: RemoveConfig & {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(success)
      }
    })
  }

  return (
    <DeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onConfirm={handleDelete}
    >
      <p>
        &ldquo;{label}&rdquo; se eliminará de forma permanente. Esta acción no
        se puede deshacer.
      </p>
    </DeleteDialog>
  )
}
