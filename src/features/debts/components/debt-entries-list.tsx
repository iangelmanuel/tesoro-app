"use client"

import { useState, useTransition } from "react"
import { cn } from "cn"
import { Link2, Pencil, Receipt, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteEntry } from "../actions"
import type { Debt, DebtEntry } from "../queries"
import { AdjustBalanceDialog } from "./adjust-balance-dialog"
import { PaymentDialog } from "./payment-dialog"

interface DebtEntriesListProps {
  debt: Pick<Debt, "id" | "kind" | "balance">
  entries: DebtEntry[]
  currency: string
  /** Deudas pagadas, cobradas o archivadas: sin editar ni eliminar */
  readOnly?: boolean
}

export function DebtEntriesList({
  debt,
  entries,
  currency,
  readOnly
}: DebtEntriesListProps) {
  if (entries.length === 0) {
    return (
      <CardEmpty
        icon={Receipt}
        message="Aún no hay pagos registrados"
      />
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {entries.map((entry) => (
        <EntryRow
          key={entry.id}
          debt={debt}
          entry={entry}
          currency={currency}
          readOnly={readOnly}
        />
      ))}
    </ul>
  )
}

function EntryRow({
  debt,
  entry,
  currency,
  readOnly
}: {
  debt: Pick<Debt, "id" | "kind" | "balance">
  entry: DebtEntry
  currency: string
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const isPayment = entry.kind === "payment"
  const label = isPayment
    ? debt.kind === "receivable"
      ? "Abono"
      : "Pago"
    : "Ajuste"
  // Un pago baja el saldo; un ajuste lo sube o lo baja según su signo
  const lowersBalance = isPayment || entry.amount < 0

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              lowersBalance
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {lowersBalance ? "−" : "+"}{" "}
            {formatCurrency(Math.abs(entry.amount), currency)}
          </span>
          {entry.transaction_id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link2
                  className="size-4 text-muted-foreground"
                  aria-label="Tiene un movimiento enlazado"
                />
              </TooltipTrigger>
              <TooltipContent>Tiene un movimiento enlazado</TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(entry.occurred_on)}
        </span>
        {entry.note && (
          <span className="truncate text-sm text-muted-foreground">
            {entry.note}
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${label.toLowerCase()}`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          {isPayment ? (
            <PaymentDialog
              debt={debt}
              entry={entry}
              open={editing}
              onOpenChange={setEditing}
            />
          ) : (
            <AdjustBalanceDialog
              debt={debt}
              entry={entry}
              currency={currency}
              open={editing}
              onOpenChange={setEditing}
            />
          )}
          <DeleteEntryButton
            entry={entry}
            label={label}
          />
        </div>
      )}
    </li>
  )
}

function DeleteEntryButton({
  entry,
  label
}: {
  entry: DebtEntry
  label: string
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEntry(entry.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${label} eliminado`)
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar ${label.toLowerCase()}`}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar este {label.toLowerCase()}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            El saldo se recalcula sin él.
            {entry.transaction_id &&
              " También se elimina su movimiento en Movimientos."}{" "}
            Esta acción no se puede deshacer.
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
