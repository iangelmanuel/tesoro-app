"use client"

import { useState, useTransition } from "react"
import { Tooltip, cn, toast } from "@heroui/react"
import { Copy, Link2, Pencil, Receipt, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CardEmpty } from "@/components/dashboard/empty-state"
import { RowActions } from "@/components/dashboard/row-actions"
import {
  type SortableConfig,
  SortableListItem,
  SortableListProvider,
  useSortableList
} from "@/components/dashboard/sortable-list"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import { deleteEntry, moveDebtEntry } from "../actions"
import { installmentLabel, installmentProgress } from "../installments"
import type { Debt, DebtEntry } from "../queries"
import { DebtEntryDialog } from "./debt-entry-dialog"
import {
  DuplicateDebtEntryDialog,
  canDuplicateDebtEntry
} from "./duplicate-debt-entry-dialog"

/**
 * Lo que el historial usa de la deuda. Día de pago, corte y próximo
 * vencimiento ubican la cuota en curso de una compra (SPEC 42)
 */
type EntriesDebt = Pick<
  Debt,
  | "id"
  | "kind"
  | "balance"
  | "name"
  | "status"
  | "schedule"
  | "due_day"
  | "closing_day"
  | "next_due_on"
>

interface DebtEntriesListProps {
  debt: EntriesDebt
  entries: DebtEntry[]
  /** Cuentas activas, para cambiar la cuenta de un pago (SPEC 42) */
  accounts?: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento de un pago (SPEC 42) */
  categories?: Category[]
  currency: string
  /**
   * La cuota del ciclo actual ya está cubierta: el duplicado de un pago
   * muestra un aviso (SPEC 49)
   */
  cycleCovered?: boolean
  /** Deudas pagadas, cobradas o archivadas: sin editar ni eliminar */
  readOnly?: boolean
}

export function DebtEntriesList({
  debt,
  entries,
  accounts,
  categories,
  currency,
  cycleCovered = false,
  readOnly
}: DebtEntriesListProps) {
  // Orden manual dentro del día (SPEC 45), como en Movimientos
  const sortable = useSortableList({
    items: entries,
    getId: (entry) => entry.id,
    getGroup: (entry) => entry.occurred_on,
    getTitle: (entry) =>
      `${entryLabel(debt, entry)} · ${formatDate(entry.occurred_on)}`,
    handleLabel: "Reordenar dentro del día",
    enabled: !readOnly,
    onMove: (source, target) => moveDebtEntry(source.id, target.id)
  })

  if (entries.length === 0) {
    return (
      <CardEmpty
        icon={Receipt}
        message="Aún no hay movimientos registrados"
      />
    )
  }

  return (
    <SortableListProvider {...sortable.providerProps}>
      <ul className="divide-y rounded-xl border">
        {sortable.items.map((entry) => (
          <EntryRow
            key={entry.id}
            debt={debt}
            entry={entry}
            accounts={accounts}
            categories={categories}
            currency={currency}
            cycleCovered={cycleCovered}
            readOnly={readOnly}
            sortable={sortable.configFor(entry)}
          />
        ))}
      </ul>
    </SortableListProvider>
  )
}

function EntryRow({
  debt,
  entry,
  accounts,
  categories,
  currency,
  cycleCovered,
  readOnly,
  sortable
}: {
  debt: EntriesDebt
  entry: DebtEntry
  accounts?: PaymentAccountOption[]
  categories?: Category[]
  currency: string
  cycleCovered: boolean
  readOnly?: boolean
  sortable?: SortableConfig
}) {
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()
  const isPayment = entry.kind === "payment"
  const isAdvance = entry.kind === "advance"
  const isFee = entry.kind === "fee"
  // Compra o avance (SPEC 42): con cuenta es un avance; sin ella, una compra
  const isPurchase = isAdvance && entry.payment_account_id === null
  const label = entryLabel(debt, entry)
  // Los ajustes no mueven cuentas. El abono de una cuenta por cobrar y el
  // avance entran a la cuenta; el resto sale de ella.
  const accountText = isPurchase
    ? null
    : isAdvance
      ? accountPhrase("A", entry.account_name)
      : isPayment
        ? accountPhrase(
            debt.kind === "receivable" ? "A" : "Desde",
            entry.account_name
          )
        : null
  // Un pago baja el saldo; un ajuste lo sube o lo baja según su signo
  const lowersBalance = isPayment || entry.amount < 0
  const feminine = isFee || isPurchase
  const installmentsText =
    isAdvance && entry.installments !== null
      ? installmentLabel(
          entry.installments,
          installmentProgress(entry, debt, debt.next_due_on)
        )
      : null

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
    <SortableListItem
      config={sortable}
      className="flex items-center gap-3 p-3"
    >
      {(handle) => (
        <>
          {handle}
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
                  <Tooltip.Content>
                    Tiene un movimiento enlazado
                  </Tooltip.Content>
                </Tooltip>
              )}
            </span>
            <span className="text-xs text-muted">
              {formatDate(entry.occurred_on)}
              {entry.occurred_time && ` · ${formatTime(entry.occurred_time)}`}
              {accountText && ` · ${accountText}`}
              {installmentsText && ` · ${installmentsText}`}
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
                  // Los ajustes se corrigen con Actualizar saldo (SPEC 49)
                  ...(canDuplicateDebtEntry(debt, entry)
                    ? [
                        {
                          id: "duplicate",
                          label: "Duplicar",
                          icon: <Copy className="size-4" />,
                          onAction: () => setDuplicating(true)
                        }
                      ]
                    : []),
                  {
                    id: "delete",
                    label: "Eliminar",
                    icon: <Trash2 className="size-4" />,
                    destructive: true,
                    onAction: () => setDeleting(true)
                  }
                ]}
              />
              {/* Un solo editor para cualquier tipo (SPEC 42, parte 3) */}
              {editing && (
                <DebtEntryDialog
                  workspaceId={entry.workspace_id}
                  entryId={entry.id}
                  initial={{ entry, debt }}
                  accounts={accounts ?? []}
                  categories={categories ?? []}
                  currency={currency}
                  open
                  onOpenChange={setEditing}
                />
              )}
              {duplicating && (
                <DuplicateDebtEntryDialog
                  workspaceId={entry.workspace_id}
                  data={{ entry, debt, cycleCovered }}
                  accounts={accounts ?? []}
                  onOpenChange={setDuplicating}
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
                  {isFee && " No se vuelve a generar."}
                  {entry.transaction_id &&
                    " También se elimina su movimiento en Movimientos."}{" "}
                  Esta acción no se puede deshacer.
                </p>
              </DeleteDialog>
            </>
          )}
        </>
      )}
    </SortableListItem>
  )
}

function accountPhrase(preposition: "A" | "Desde", name: string | null) {
  return name ? `${preposition} ${name}` : "Fuera de cuentas"
}

/** Tipo del movimiento de la deuda: Pago, Abono, Compra, Avance… */
function entryLabel(debt: Pick<Debt, "kind">, entry: DebtEntry) {
  if (entry.kind === "fee") return "Cuota de manejo"
  if (entry.kind === "advance") {
    // Con cuenta es un avance; sin ella, una compra (SPEC 42)
    return entry.payment_account_id === null ? "Compra" : "Avance"
  }
  if (entry.kind === "payment") {
    return debt.kind === "receivable" || entry.is_extra_payment
      ? "Abono"
      : "Pago"
  }
  return "Ajuste"
}
