"use client"

import { useState } from "react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
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
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { ToneBadge } from "@/components/dashboard/tone-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import { frequencyLabel } from "../occurrences"
import type { RecurringExpense } from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import { RecurringExpenseSheet } from "./recurring-expense-sheet"
import { useRecurringExpenseActions } from "./use-recurring-expense-actions"

/** Superficie de la tabla y de su skeleton */
const TABLE_SURFACE = cn(SURFACE_LIST, "divide-y-0 px-2")
const MIN_WIDTH = "56rem"
const COLUMNS = 7

function validityLabel(expense: RecurringExpense) {
  const from = formatDate(expense.starts_on)
  return expense.ends_on
    ? `${from} – ${formatDate(expense.ends_on)}`
    : `Desde ${from}`
}

interface RecurringExpensesListProps {
  expenses: RecurringExpense[]
  categories: Category[]
  /** Cuentas para "Marcar como pagado" desde el Sheet */
  accounts: PaymentAccountOption[]
  currency: string
}

// Client: el nombre (o un clic en la fila) abre el Sheet del gasto
// (SPEC 37) y el ⋯ abre sus acciones. Las categorías y cuentas viajan una
// sola vez
export function RecurringExpensesList({
  expenses,
  categories,
  accounts,
  currency
}: RecurringExpensesListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Al eliminarlo desaparece de la lista: el Sheet se queda sin gasto
  const selected = expenses.find((expense) => expense.id === selectedId)

  function open(id: string) {
    setSelectedId(id)
    setSheetOpen(true)
  }

  return (
    <>
      <ScrollTable
        minWidth={MIN_WIDTH}
        tour="recurring-list"
        className={TABLE_SURFACE}
      >
        <Table aria-label="Gastos fijos">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-end">Monto</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28 md:w-16">
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                categories={categories}
                accounts={accounts}
                currency={currency}
                onOpen={() => open(expense.id)}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollTable>
      {selected && (
        <RecurringExpenseSheet
          key={selected.id}
          expense={selected}
          categories={categories}
          accounts={accounts}
          currency={currency}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      )}
    </>
  )
}

/** La tabla mientras carga: misma superficie, columnas y ancho mínimo */
export function RecurringExpensesListSkeleton() {
  return (
    <ScrollTableSkeleton
      columns={COLUMNS}
      rows={4}
      amountColumn={false}
      minWidth={MIN_WIDTH}
    />
  )
}

// Fila con el menú contextual (clic derecho y pulsación larga) y las mismas
// acciones que su ⋯: editar, pausar o reanudar y eliminar. Los diálogos se
// controlan desde aquí porque el menú no puede alojar sus triggers
function ExpenseRow({
  expense,
  categories,
  accounts,
  currency,
  onOpen
}: {
  expense: RecurringExpense
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
  onOpen: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const {
    pending,
    toggle: handleToggle,
    remove
  } = useRecurringExpenseActions(expense)

  const actions: RowAction[] = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil />,
      onAction: () => setEditing(true)
    },
    {
      id: "toggle",
      label: expense.is_active ? "Pausar" : "Reanudar",
      icon: expense.is_active ? <Pause /> : <Play />,
      onAction: handleToggle,
      disabled: pending
    },
    {
      id: "delete",
      label: "Eliminar",
      icon: <Trash2 />,
      destructive: true,
      onAction: () => setDeleting(true)
    }
  ]

  return (
    <RowContextMenu
      label={expense.name}
      actions={actions}
    >
      <TableRow
        onClick={onOpen}
        className={cn(
          "cursor-pointer",
          !expense.is_active && "text-muted-foreground"
        )}
      >
        <TableCell className="max-w-64 min-w-44 whitespace-normal">
          {/* El nombre es el control de teclado que abre el detalle */}
          <button
            type="button"
            title={expense.name}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
            className="line-clamp-3 min-h-11 cursor-pointer rounded-md text-left font-medium break-words outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {expense.name}
          </button>
        </TableCell>
        <TableCell>
          <CategoryBadge
            name={
              expense.category.archived_at
                ? `${expense.category.name} (archivada)`
                : expense.category.name
            }
            icon={expense.category.icon}
            color={expense.category.color}
          />
        </TableCell>
        <TableCell className="text-end font-medium tabular-nums">
          <Amount
            value={expense.amount}
            currency={currency}
          />
        </TableCell>
        <TableCell>{frequencyLabel(expense)}</TableCell>
        <TableCell className="text-muted-foreground">
          {validityLabel(expense)}
        </TableCell>
        <TableCell>
          <ToneBadge
            className={
              expense.is_active
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.neutral
            }
          >
            {expense.is_active ? "Activo" : "Pausado"}
          </ToneBadge>
        </TableCell>
        {/* Las acciones no abren el detalle */}
        <TableCell onClick={(event) => event.stopPropagation()}>
          <RowActions
            label={expense.name}
            actions={actions}
          />
          <RowMenuBoundary>
            <RecurringExpenseDialog
              workspaceId={expense.workspace_id}
              categories={categories}
              accounts={accounts}
              expense={expense}
              open={editing}
              onOpenChange={setEditing}
            />
            <DeleteDialog
              open={deleting}
              onOpenChange={setDeleting}
              title="¿Eliminar este gasto fijo?"
              onConfirm={() => remove()}
            >
              <p className="text-sm text-muted-foreground">
                &ldquo;{expense.name}&rdquo; dejará de aparecer en tus próximos
                pagos. Los movimientos que ya registraste como pago se conservan
                en Movimientos.
              </p>
            </DeleteDialog>
          </RowMenuBoundary>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  )
}
