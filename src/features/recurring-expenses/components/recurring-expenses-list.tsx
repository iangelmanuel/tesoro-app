"use client"

import { useTransition } from "react"
import {
  AlertDialog,
  Button,
  Chip,
  Table,
  Tooltip,
  cn,
  toast
} from "@heroui/react"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { DataRow, DataRows } from "@/components/dashboard/data-rows"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteRecurringExpense, toggleRecurringExpense } from "../actions"
import { frequencyLabel } from "../occurrences"
import type { RecurringExpense } from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"

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
    <>
      {/* < 768 px: una tarjeta por gasto fijo; la tabla va en display: none */}
      <DataRows
        boxed
        label="Gastos fijos"
      >
        {expenses.map((expense) => (
          <DataRow
            boxed
            key={expense.id}
            className={cn(!expense.is_active && "text-muted")}
            title={expense.name}
            value={formatCurrency(expense.amount, currency)}
            meta={
              <>
                <CategoryBadge
                  name={
                    expense.category.archived_at
                      ? `${expense.category.name} (archivada)`
                      : expense.category.name
                  }
                  icon={expense.category.icon}
                  color={expense.category.color}
                />
                <span>{frequencyLabel(expense)}</span>
                <span>{validityLabel(expense)}</span>
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
              </>
            }
            actions={
              <>
                <RecurringExpenseDialog
                  categories={categories}
                  expense={expense}
                  trigger={
                    <Button
                      variant="ghost"
                      isIconOnly
                      size="sm"
                      className="max-md:size-11"
                      aria-label={`Editar ${expense.name}`}
                    >
                      <Pencil />
                    </Button>
                  }
                />
                <ToggleRecurringExpenseButton expense={expense} />
                <DeleteRecurringExpenseButton expense={expense} />
              </>
            }
          />
        ))}
      </DataRows>
      <Table className="hidden md:block">
        <Table.ScrollContainer>
          <Table.Content aria-label="Gastos fijos">
            <Table.Header>
              <Table.Column isRowHeader>Nombre</Table.Column>
              <Table.Column>Categoría</Table.Column>
              <Table.Column className="text-end">Monto</Table.Column>
              <Table.Column>Frecuencia</Table.Column>
              <Table.Column>Vigencia</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column className="w-28">
                <span className="sr-only">Acciones</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {expenses.map((expense) => (
                <Table.Row
                  key={expense.id}
                  className={cn(!expense.is_active && "text-muted")}
                >
                  <Table.Cell className="max-w-48">
                    <p className="truncate font-medium">{expense.name}</p>
                  </Table.Cell>
                  <Table.Cell>
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
                  <Table.Cell className="text-end font-medium tabular-nums">
                    {formatCurrency(expense.amount, currency)}
                  </Table.Cell>
                  <Table.Cell>{frequencyLabel(expense)}</Table.Cell>
                  <Table.Cell className="text-muted">
                    {validityLabel(expense)}
                  </Table.Cell>
                  <Table.Cell>
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
                    <div className="flex justify-end gap-1">
                      <RecurringExpenseDialog
                        categories={categories}
                        expense={expense}
                        trigger={
                          <Button
                            variant="ghost"
                            isIconOnly
                            size="sm"
                            aria-label={`Editar ${expense.name}`}
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      <ToggleRecurringExpenseButton expense={expense} />
                      <DeleteRecurringExpenseButton expense={expense} />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </>
  )
}

function ToggleRecurringExpenseButton({
  expense
}: {
  expense: RecurringExpense
}) {
  const [pending, startTransition] = useTransition()
  const label = expense.is_active
    ? `Pausar ${expense.name}`
    : `Reanudar ${expense.name}`

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

  return (
    <Tooltip delay={500}>
      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        className="max-md:size-11"
        aria-label={label}
        isDisabled={pending}
        onPress={handleToggle}
      >
        {expense.is_active ? <Pause /> : <Play />}
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  )
}

function DeleteRecurringExpenseButton({
  expense
}: {
  expense: RecurringExpense
}) {
  const [pending, startTransition] = useTransition()

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
    <AlertDialog>
      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        className="max-md:size-11"
        aria-label={`Eliminar ${expense.name}`}
        isDisabled={pending}
      >
        <Trash2 />
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                ¿Eliminar este gasto fijo?
              </AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  &ldquo;{expense.name}&rdquo; dejará de aparecer en tus
                  próximos pagos. Los movimientos que ya registraste como pago
                  se conservan en Movimientos.
                </p>
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={handleDelete}
              >
                Eliminar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
