"use client"

import { useState } from "react"
import { Chip, Table, cn } from "@heroui/react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { RowActions } from "@/components/dashboard/row-actions"
import { ScrollTable } from "@/components/dashboard/scroll-table"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { frequencyLabel } from "../occurrences"
import type { RecurringExpense } from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import { RecurringExpenseSheet } from "./recurring-expense-sheet"
import { useRecurringExpenseActions } from "./use-recurring-expense-actions"

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
  /** Cuentas para "Marcar como pagado" desde el Sheet */
  accounts: PaymentAccountOption[]
  currency: string
}

// Client: un clic en la fila abre el Sheet del gasto (SPEC 37) y el ⋮ abre
// sus acciones. Las categorías y cuentas viajan una sola vez
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

  return (
    <>
      <RecurringExpensesTable
        expenses={expenses}
        categories={categories}
        currency={currency}
        onOpen={(id) => {
          setSelectedId(id)
          setSheetOpen(true)
        }}
      />
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

function RecurringExpensesTable({
  expenses,
  categories,
  currency,
  onOpen
}: Omit<RecurringExpensesListProps, "accounts"> & {
  onOpen: (id: string) => void
}) {
  return (
    <ScrollTable
      minWidth="56rem"
      tour="recurring-list"
    >
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
              <Table.Column className="w-28 md:w-16">
                <span className="sr-only">Acciones</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {expenses.map((expense) => (
                <Table.Row
                  key={expense.id}
                  id={expense.id}
                  textValue={expense.name}
                  onAction={() => onOpen(expense.id)}
                  className={cn(
                    "cursor-pointer",
                    !expense.is_active && "text-muted"
                  )}
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
                  <Table.Cell>
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
  const { toggle: handleToggle, remove } = useRecurringExpenseActions(expense)

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
        workspaceId={expense.workspace_id}
        categories={categories}
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
        <p className="text-sm text-muted">
          &ldquo;{expense.name}&rdquo; dejará de aparecer en tus próximos pagos.
          Los movimientos que ya registraste como pago se conservan en
          Movimientos.
        </p>
      </DeleteDialog>
    </>
  )
}
