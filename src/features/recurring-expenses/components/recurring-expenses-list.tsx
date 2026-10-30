"use client"

import { useTransition } from "react"
import { cn } from "cn"
import { Pause, Pencil, Play, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
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
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead>Frecuencia</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-28">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow
              key={expense.id}
              className={cn(!expense.is_active && "text-muted-foreground")}
            >
              <TableCell className="max-w-48">
                <p className="truncate font-medium">{expense.name}</p>
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
              <TableCell className="text-right font-medium tabular-nums">
                {formatCurrency(expense.amount, currency)}
              </TableCell>
              <TableCell>{frequencyLabel(expense)}</TableCell>
              <TableCell className="text-muted-foreground">
                {validityLabel(expense)}
              </TableCell>
              <TableCell>
                {expense.is_active ? (
                  <Badge variant="secondary">Activo</Badge>
                ) : (
                  <Badge variant="outline">Pausado</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <RecurringExpenseDialog
                    categories={categories}
                    expense={expense}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${expense.name}`}
                      >
                        <Pencil />
                      </Button>
                    }
                  />
                  <ToggleRecurringExpenseButton expense={expense} />
                  <DeleteRecurringExpenseButton expense={expense} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
        toast.error(result.error)
      } else {
        toast.success(
          expense.is_active ? "Gasto fijo pausado" : "Gasto fijo reanudado"
        )
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={handleToggle}
    >
      {expense.is_active ? <Pause /> : <Play />}
    </Button>
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
        toast.error(result.error)
      } else {
        toast.success("Gasto fijo eliminado")
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${expense.name}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este gasto fijo?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{expense.name}&rdquo; dejará de aparecer en tus próximos
            pagos. Los movimientos que ya registraste como pago se conservan en
            Movimientos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
