"use client"

import { useState, useTransition } from "react"
import { AlertDialog, Button, Tooltip, cn, toast } from "@heroui/react"
import { Link2, Pencil, Receipt, Trash2 } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
          {accountText && ` · ${accountText}`}
        </span>
        {entry.note && (
          <span className="truncate text-sm text-muted">{entry.note}</span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            aria-label={`Editar ${label.toLowerCase()}`}
            onPress={() => setEditing(true)}
          >
            <Pencil />
          </Button>
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
          <DeleteEntryButton
            entry={entry}
            label={label}
            feminine={isFee}
          />
        </div>
      )}
    </li>
  )
}

function accountPhrase(preposition: "A" | "Desde", name: string | null) {
  return name ? `${preposition} ${name}` : "Fuera de cuentas"
}

function DeleteEntryButton({
  entry,
  label,
  feminine
}: {
  entry: DebtEntry
  label: string
  feminine?: boolean
}) {
  const [pending, startTransition] = useTransition()

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
    <AlertDialog>
      <Button
        variant="ghost"
        isIconOnly
        size="sm"
        aria-label={`Eliminar ${label.toLowerCase()}`}
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
                ¿Eliminar {feminine ? "esta" : "este"} {label.toLowerCase()}?
              </AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  El saldo se recalcula sin {feminine ? "ella" : "él"}.
                  {feminine && " No se vuelve a generar."}
                  {entry.transaction_id &&
                    " También se elimina su movimiento en Movimientos."}{" "}
                  Esta acción no se puede deshacer.
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
