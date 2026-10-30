"use client"

import { useTransition } from "react"
import { cn } from "cn"
import { Pencil, Trash2 } from "lucide-react"
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
import { Button } from "@/components/ui/button"
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
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteTransaction } from "../actions"
import type { TransactionWithCategory } from "../queries"
import { TransactionDialog } from "./transaction-dialog"

interface TransactionsTableProps {
  rows: TransactionWithCategory[]
  categories: Category[]
  accounts: AccountOption[]
  currency: string
}

// Client: cada fila abre el diálogo de edición, y así las categorías viajan
// una sola vez en vez de una por fila
export function TransactionsTable({
  rows,
  categories,
  accounts,
  currency
}: TransactionsTableProps) {
  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="text-muted-foreground">
                {formatDate(transaction.occurred_on)}
              </TableCell>
              <TableCell className="max-w-64">
                <p className="truncate font-medium">
                  {transaction.description}
                </p>
                {transaction.note && (
                  <p className="truncate text-xs text-muted-foreground">
                    {transaction.note}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <CategoryBadge
                  name={transaction.category.name}
                  icon={transaction.category.icon}
                  color={transaction.category.color}
                />
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  transaction.type === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {transaction.type === "income" ? "+" : "−"}
                {formatCurrency(transaction.amount, currency)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <TransactionDialog
                    categories={categories}
                    accounts={accounts}
                    transaction={transaction}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${transaction.description}`}
                      >
                        <Pencil />
                      </Button>
                    }
                  />
                  <DeleteTransactionButton transaction={transaction} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DeleteTransactionButton({
  transaction
}: {
  transaction: TransactionWithCategory
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(transaction.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Movimiento eliminado")
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${transaction.description}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{transaction.description}&rdquo; se eliminará de forma
            permanente. Esta acción no se puede deshacer.
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
