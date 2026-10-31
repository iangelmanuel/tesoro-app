"use client"

import { useTransition } from "react"
import { cn } from "cn"
import { ArrowLeftRight, Pencil, RefreshCw, Trash2 } from "lucide-react"
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
import { deleteAdjustment, deleteTransfer } from "@/features/accounts/actions"
import {
  AccountLabel,
  type AccountOption
} from "@/features/accounts/components/account-select"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteTransaction } from "../actions"
import type { EditableTransaction, LedgerEntry } from "../queries"
import { TransactionDialog } from "./transaction-dialog"

interface TransactionsTableProps {
  workspaceId: string
  rows: LedgerEntry[]
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: AccountOption[]
  currency: string
}

type TransferEntry = Extract<LedgerEntry, { kind: "transfer" }>
type AdjustmentEntry = Extract<LedgerEntry, { kind: "adjustment" }>

// Client: cada fila abre el diálogo de edición, y así las categorías y las
// cuentas viajan una sola vez en vez de una por fila
export function TransactionsTable({
  workspaceId,
  rows,
  categories,
  accounts,
  currency
}: TransactionsTableProps) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const accountName = (id: string) => accountsById.get(id)?.name ?? "Cuenta"

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Cuenta</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.kind === "transfer") {
              return (
                <TransferRow
                  key={row.id}
                  workspaceId={workspaceId}
                  transfer={row}
                  label={`${accountName(row.from_account_id)} → ${accountName(row.to_account_id)}`}
                  accounts={accounts}
                  currency={currency}
                />
              )
            }
            if (row.kind === "adjustment") {
              return (
                <AdjustmentRow
                  key={row.id}
                  workspaceId={workspaceId}
                  adjustment={row}
                  label={`Ajuste de saldo · ${accountName(row.account_id)}`}
                  currency={currency}
                />
              )
            }

            const transaction = row.transaction
            const category = categoriesById.get(transaction.category_id)
            const account = transaction.account_id
              ? accountsById.get(transaction.account_id)
              : undefined

            return (
              <TableRow key={transaction.id}>
                <TableCell className="text-muted-foreground">
                  {formatDate(transaction.occurred_on)}
                </TableCell>
                <DescriptionCell
                  title={transaction.description}
                  note={transaction.note}
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
                <TableCell>
                  {account ? (
                    <AccountLabel account={account} />
                  ) : (
                    <span className="text-muted-foreground">Sin cuenta</span>
                  )}
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
                      workspaceId={workspaceId}
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
                    <DeleteTransactionButton
                      workspaceId={workspaceId}
                      transaction={transaction}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
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
  return (
    <TableCell className="max-w-64">
      <p className="flex items-center gap-2 truncate font-medium">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{title}</span>
      </p>
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </TableCell>
  )
}

// Traspaso: neutro, sin signo y sin categoría. No suma a los totales.
function TransferRow({
  workspaceId,
  transfer,
  label,
  accounts,
  currency
}: {
  workspaceId: string
  transfer: TransferEntry
  label: string
  accounts: AccountOption[]
  currency: string
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">
        {formatDate(transfer.occurred_on)}
      </TableCell>
      <DescriptionCell
        title={label}
        note={transfer.note}
        icon={ArrowLeftRight}
      />
      <TableCell className="text-muted-foreground">Traspaso</TableCell>
      <TableCell />
      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
        {formatCurrency(transfer.amount, currency)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <TransferDialog
            workspaceId={workspaceId}
            accounts={accounts}
            transfer={transfer}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar traspaso ${label}`}
              >
                <Pencil />
              </Button>
            }
          />
          <DeleteEntryButton
            label={`Traspaso ${label}`}
            title="¿Eliminar este traspaso?"
            success="Traspaso eliminado"
            onDelete={() => deleteTransfer(workspaceId, transfer.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

// Ajuste de saldo: neutro, con signo. Solo se elimina.
function AdjustmentRow({
  workspaceId,
  adjustment,
  label,
  currency
}: {
  workspaceId: string
  adjustment: AdjustmentEntry
  label: string
  currency: string
}) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">
        {formatDate(adjustment.occurred_on)}
      </TableCell>
      <DescriptionCell
        title={label}
        note={adjustment.note}
        icon={RefreshCw}
      />
      <TableCell className="text-muted-foreground">Ajuste</TableCell>
      <TableCell />
      <TableCell className="text-right font-medium text-muted-foreground tabular-nums">
        {adjustment.amount > 0 ? "+" : "−"}
        {formatCurrency(Math.abs(adjustment.amount), currency)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <DeleteEntryButton
            label={label}
            title="¿Eliminar este ajuste?"
            success="Ajuste eliminado"
            onDelete={() => deleteAdjustment(workspaceId, adjustment.id)}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

function DeleteTransactionButton({
  workspaceId,
  transaction
}: {
  workspaceId: string
  transaction: EditableTransaction
}) {
  return (
    <DeleteEntryButton
      label={transaction.description}
      title="¿Eliminar este movimiento?"
      success="Movimiento eliminado"
      onDelete={() => deleteTransaction(workspaceId, transaction.id)}
    />
  )
}

function DeleteEntryButton({
  label,
  title,
  success,
  onDelete
}: {
  label: string
  title: string
  success: string
  onDelete: () => Promise<{ error?: string }>
}) {
  const [pending, startTransition] = useTransition()

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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${label}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{label}&rdquo; se eliminará de forma permanente. Esta acción
            no se puede deshacer.
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
