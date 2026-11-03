"use client"

import { useState, useTransition } from "react"
import { Tooltip, cn, toast } from "@heroui/react"
import { Link2, Pencil, Receipt, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { RowActions } from "@/components/dashboard/row-actions"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
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
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()
  const isPayment = entry.kind === "payment"
  const isAdvance = entry.kind === "advance"
  const isFee = entry.kind === "fee"
  const label = isFee
    ? "Cuota de manejo"
    : isAdvance
      ? "Avance"
      : isPayment
        ? debt.kind === "receivable"
          ? "Abono"
          : "Pago"
        : "Ajuste"
  // Los ajustes no mueven cuentas. El abono de una cuenta por cobrar y el
  // avance entran a la cuenta; el resto sale de ella.
  const accountText = isAdvance
    ? accountPhrase("A", entry.account_name)
    : isPayment
      ? accountPhrase(
          debt.kind === "receivable" ? "A" : "Desde",
          entry.account_name
        )
      : null
  // Un pago baja el saldo; un ajuste lo sube o lo baja según su signo
  const lowersBalance = isPayment || entry.amount < 0
  const feminine = isFee

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEntry(entry.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(`${label} ${feminine ? "eliminada" : "eliminado"}`)
      }
    })
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {isFee && entry.generated && (
            <span className="text-xs text-muted">· automática</span>
          )}
          <span
            className={cn(
              "font-medium tabular-nums",
              lowersBalance ? "text-(--income)" : "text-(--expense)"
            )}
          >
            {lowersBalance ? "−" : "+"}{" "}
            {formatCurrency(Math.abs(entry.amount), currency)}
          </span>
          {entry.transaction_id && (
            <Tooltip delay={500}>
              <Tooltip.Trigger
                aria-label="Tiene un movimiento enlazado"
                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Link2 className="size-4 text-muted" />
              </Tooltip.Trigger>
              <Tooltip.Content>Tiene un movimiento enlazado</Tooltip.Content>
            </Tooltip>
          )}
        </span>
        <span className="text-xs text-muted">
          {formatDate(entry.occurred_on)}
          {entry.occurred_time && ` · ${formatTime(entry.occurred_time)}`}
          {accountText && ` · ${accountText}`}
        </span>
        {entry.note && (
          <span className="line-clamp-3 text-sm break-words text-muted">
            {entry.note}
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <RowActions
            label={label.toLowerCase()}
            actions={[
              {
                id: "edit",
                label: "Editar",
                icon: <Pencil className="size-4" />,
                onAction: () => setEditing(true)
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
          {isPayment || isAdvance || isFee ? (
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
          <DeleteDialog
            open={deleting}
            onOpenChange={setDeleting}
            title={`¿Eliminar ${feminine ? "esta" : "este"} ${label.toLowerCase()}?`}
            onConfirm={handleDelete}
          >
            <p className="text-sm text-muted">
              El saldo se recalcula sin {feminine ? "ella" : "él"}.
              {feminine && " No se vuelve a generar."}
              {entry.transaction_id &&
                " También se elimina su movimiento en Movimientos."}{" "}
              Esta acción no se puede deshacer.
            </p>
          </DeleteDialog>
        </>
      )}
    </li>
  )
}

function accountPhrase(preposition: "A" | "Desde", name: string | null) {
  return name ? `${preposition} ${name}` : "Fuera de cuentas"
}
