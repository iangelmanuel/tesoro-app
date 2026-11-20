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
import type { AccountOption } from "@/features/accounts/components/account-select"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatDate } from "@/libs/format"
import { incomeFrequencyLabel } from "../occurrences"
import type { RecurringIncome } from "../queries"
import { useOpenIncomeSheet } from "./income-sheet-context"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import { useRecurringIncomeActions } from "./use-recurring-income-actions"

/** Superficie de la tabla y de su skeleton */
const TABLE_SURFACE = cn(SURFACE_LIST, "divide-y-0 px-2")
const MIN_WIDTH = "60rem"
const COLUMNS = 8

function validityLabel(income: RecurringIncome) {
  const from = formatDate(income.starts_on)
  return income.ends_on
    ? `${from} – ${formatDate(income.ends_on)}`
    : `Desde ${from}`
}

interface RecurringIncomesListProps {
  incomes: RecurringIncome[]
  categories: Category[]
  accounts: AccountOption[]
  currency: string
}

// Client: el nombre (o un clic en la fila) abre el Sheet del ingreso fijo
// (SPEC 38) y el ⋯ abre sus acciones. Las categorías y cuentas viajan una
// sola vez
export function RecurringIncomesList({
  incomes,
  categories,
  accounts,
  currency
}: RecurringIncomesListProps) {
  const openSheet = useOpenIncomeSheet()

  return (
    <ScrollTable
      minWidth={MIN_WIDTH}
      tour="income-list"
      className={TABLE_SURFACE}
    >
      <Table aria-label="Ingresos fijos">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-end">Monto esperado</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-28 md:w-16">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incomes.map((income) => (
            <IncomeRow
              key={income.id}
              income={income}
              categories={categories}
              accounts={accounts}
              currency={currency}
              onOpen={() => openSheet(income.id)}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollTable>
  )
}

/** La tabla mientras carga: misma superficie, columnas y ancho mínimo */
export function RecurringIncomesListSkeleton() {
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
function IncomeRow({
  income,
  categories,
  accounts,
  currency,
  onOpen
}: {
  income: RecurringIncome
  categories: Category[]
  accounts: AccountOption[]
  currency: string
  onOpen: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const {
    pending,
    toggle: handleToggle,
    remove
  } = useRecurringIncomeActions(income)

  const actions: RowAction[] = [
    {
      id: "edit",
      label: "Editar",
      icon: <Pencil />,
      onAction: () => setEditing(true)
    },
    {
      id: "toggle",
      label: income.is_active ? "Pausar" : "Reanudar",
      icon: income.is_active ? <Pause /> : <Play />,
      onAction: handleToggle,
      isDisabled: pending
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
      label={income.name}
      actions={actions}
    >
      <TableRow
        onClick={onOpen}
        className={cn(
          "cursor-pointer",
          !income.is_active && "text-muted-foreground"
        )}
      >
        <TableCell className="max-w-64 min-w-44 whitespace-normal">
          {/* El nombre es el control de teclado que abre el detalle */}
          <button
            type="button"
            data-tour="income-detail"
            title={income.name}
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
            className="line-clamp-3 min-h-11 cursor-pointer rounded-md text-left font-medium break-words outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {income.name}
          </button>
        </TableCell>
        <TableCell>
          <CategoryBadge
            name={
              income.category.archived_at
                ? `${income.category.name} (archivada)`
                : income.category.name
            }
            icon={income.category.icon}
            color={income.category.color}
          />
        </TableCell>
        <TableCell className="text-end font-medium">
          <Amount
            value={income.amount}
            currency={currency}
          />
        </TableCell>
        <TableCell>{incomeFrequencyLabel(income)}</TableCell>
        <TableCell className="text-muted-foreground">
          {income.accountName ?? "Sin cuenta"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {validityLabel(income)}
        </TableCell>
        <TableCell>
          <ToneBadge
            className={
              income.is_active
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.neutral
            }
          >
            {income.is_active ? "Activo" : "Pausado"}
          </ToneBadge>
        </TableCell>
        {/* Las acciones no abren el detalle */}
        <TableCell onClick={(event) => event.stopPropagation()}>
          <RowActions
            label={income.name}
            actions={actions}
          />
          <RowMenuBoundary>
            <RecurringIncomeDialog
              workspaceId={income.workspace_id}
              categories={categories}
              accounts={accounts}
              income={income}
              open={editing}
              onOpenChange={setEditing}
            />
            <DeleteDialog
              open={deleting}
              onOpenChange={setDeleting}
              title="¿Eliminar este ingreso fijo?"
              onConfirm={() => remove()}
            >
              <p className="text-sm text-muted-foreground">
                &ldquo;{income.name}&rdquo; dejará de aparecer en tus próximos
                ingresos y en el registro de ingresos. Los movimientos que ya
                registraste se conservan en Movimientos.
              </p>
            </DeleteDialog>
          </RowMenuBoundary>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  )
}
