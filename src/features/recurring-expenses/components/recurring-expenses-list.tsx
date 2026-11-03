"use client"

import { useState, useTransition } from "react"
import { Chip, Table, cn, toast } from "@heroui/react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { RowActions } from "@/components/dashboard/row-actions"
import {
  STICKY_ACTIONS,
  STICKY_ACTIONS_HEAD,
  ScrollTable
} from "@/components/dashboard/scroll-table"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteRecurringExpense, toggleRecurringExpense } from "../actions"
import { frequencyLabel } from "../occurrences"
import type { RecurringExpense } from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"

const NOWRAP = "whitespace-nowrap"

function validityLabel(expense: RecurringExpense) {
  const from = formatDate(expense.starts_on)
  return expense.ends_on
    ? `${from} – ${formatDate(expense.ends_on)}`
    : `Desde ${from}`
}

interface RecurringExpensesListProps {
  expenses: RecurringExpense[]
  categories: Category[]
  currency: string
}

// Client: cada fila abre el diálogo de edición, y así las categorías viajan
// una sola vez en vez de una por fila
export function RecurringExpensesList({
  expenses,
  categories,
  currency
}: RecurringExpensesListProps) {
  return (
    <ScrollTable minWidth="56rem">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Gastos fijos">
            <Table.Header>
              <Table.Column isRowHeader>Nombre</Table.Column>
              <Table.Column className={NOWRAP}>Categoría</Table.Column>
              <Table.Column className={cn("text-end", NOWRAP)}>
                Monto
              </Table.Column>
              <Table.Column className={NOWRAP}>Frecuencia</Table.Column>
              <Table.Column className={NOWRAP}>Vigencia</Table.Column>
              <Table.Column className={NOWRAP}>Estado</Table.Column>
              <Table.Column className={cn("w-28 md:w-16", STICKY_ACTIONS_HEAD)}>
                <span className="sr-only">Acciones</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {expenses.map((expense) => (
                <Table.Row
                  key={expense.id}
                  className={cn(!expense.is_active && "text-muted")}
                >
                  <Table.Cell className="max-w-64 min-w-44">
                    <p
                      title={expense.name}
                      className="line-clamp-3 font-medium break-words"
                    >
                      {expense.name}
                    </p>
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    <CategoryBadge
                      name={
                        expense.category.archived_at
                          ? `${expense.category.name} (archivada)`
                          : expense.category.name
                      }
                      icon={expense.category.icon}
                      color={expense.category.color}
                    />
                  </Table.Cell>
                  <Table.Cell
                    className={cn("text-end font-medium tabular-nums", NOWRAP)}
                  >
                    {formatCurrency(expense.amount, currency)}
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    {frequencyLabel(expense)}
                  </Table.Cell>
                  <Table.Cell className={cn("text-muted", NOWRAP)}>
                    {validityLabel(expense)}
                  </Table.Cell>
                  <Table.Cell className={NOWRAP}>
                    {expense.is_active ? (
                      <Chip size="sm">Activo</Chip>
                    ) : (
                      <Chip
                        size="sm"
                        variant="tertiary"
                      >
                        Pausado
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell className={STICKY_ACTIONS}>
                    <ExpenseActions
                      expense={expense}
                      categories={categories}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </ScrollTable>
  )
}

// Editar, pausar o reanudar y eliminar. Los diálogos se controlan desde aquí
// porque el menú de escritorio no puede alojar sus triggers
function ExpenseActions({
  expense,
  categories
}: {
  expense: RecurringExpense
  categories: Category[]
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRecurringExpense(
        expense.id,
        !expense.is_active
      )
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(
          expense.is_active ? "Gasto fijo pausado" : "Gasto fijo reanudado"
        )
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteRecurringExpense(expense.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Gasto fijo eliminado")
      }
    })
  }

  return (
    <>
      <RowActions
        label={expense.name}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil className="size-4" />,
            onAction: () => setEditing(true)
          },
          {
            id: "toggle",
            label: expense.is_active ? "Pausar" : "Reanudar",
            icon: expense.is_active ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            ),
            onAction: handleToggle
          },
          {
            id: "delete",
            label: "Eliminar",
            icon: <Trash2 className="size-4" />,
            destructive: true,
            onAction: () => setDeleting(true)
          }
        ]}
      />
      <RecurringExpenseDialog
        categories={categories}
        expense={expense}
        open={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar este gasto fijo?"
        onConfirm={handleDelete}
      >
        <p className="text-sm text-muted">
          &ldquo;{expense.name}&rdquo; dejará de aparecer en tus próximos pagos.
          Los movimientos que ya registraste como pago se conservan en
          Movimientos.
        </p>
      </DeleteDialog>
    </>
  )
}
