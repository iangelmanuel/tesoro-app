"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Copy, Link2, Pencil, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { RowActions } from "@/components/dashboard/data/row-actions"
import {
  type SortableConfig,
  SortableListItem
} from "@/components/dashboard/data/sortable-list"
import { CARD_ROW } from "@/components/dashboard/data/surface"
import {
  TONE_BADGE_CLASSES,
  TONE_TEXT_CLASSES
} from "@/components/dashboard/feedback/tone"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { useActionToast } from "@/hooks/use-action-toast"
import { cn } from "@/libs/cn"
import { formatShortDate, formatTime } from "@/libs/format"
import { deleteEntry } from "../entry-actions"
import {
  type EntriesDebt,
  entryAccountText,
  entryLabel,
  isFeminineEntry,
  lowersBalance
} from "../entry-list"
import { installmentLabel, installmentProgress } from "../installments"
import type { DebtEntry } from "../queries"
import {
  type CollectableReceivable,
  lastCoveredPeriod,
  nextPendingInstallment
} from "../receivable-collect"
import { DebtEntryDialog } from "./debt-entry-dialog"
import {
  DuplicateDebtEntryDialog,
  canDuplicateDebtEntry
} from "./duplicate-debt-entry-dialog"
import { ReceivableCollectDialog } from "./receivable-collect-form"

export function DebtEntriesListRow({
  debt,
  entry,
  accounts,
  categories,
  currency,
  cycleCovered,
  collectable,
  readOnly,
  sortable
}: {
  debt: EntriesDebt
  entry: DebtEntry
  accounts?: PaymentAccountOption[]
  categories?: Category[]
  currency: string
  cycleCovered: boolean
  collectable?: CollectableReceivable
  readOnly?: boolean
  sortable?: SortableConfig
}) {
  const [editing, setEditing] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { run } = useActionToast()
  const isAdvance = entry.kind === "advance"
  const isFee = entry.kind === "fee"
  const label = entryLabel(debt, entry)
  const feminine = isFeminineEntry(entry)
  // Como en un extracto, la fila se nombra por su concepto (descripción del
  // movimiento o nota) y el tipo pasa a la línea de abajo
  const title = entry.description ?? entry.note ?? label
  const note = entry.note && entry.note !== title ? entry.note : null
  // Cobro de un Me deben mensual: el duplicado cubre la cuota pendiente
  // siguiente a la última que cubrió el original; sin ella no se duplica
  const isMonthlyCollect =
    collectable?.schedule === "monthly" && entry.kind === "payment"
  const duplicatePeriod = isMonthlyCollect
    ? nextPendingInstallment(collectable, lastCoveredPeriod(entry))
    : null
  const canDuplicate = isMonthlyCollect
    ? duplicatePeriod !== null
    : canDuplicateDebtEntry(debt, entry)
  const accountText = entryAccountText(debt, entry)
  const installmentsText =
    isAdvance && entry.installments !== null
      ? installmentLabel(
          entry.installments,
          installmentProgress(entry, debt, debt.next_due_on)
        )
      : null

  function handleDelete() {
    run(
      () => deleteEntry(entry.id),
      `${label} ${feminine ? "eliminada" : "eliminado"}`
    )
  }

  return (
    <SortableListItem
      config={sortable}
      className={cn(CARD_ROW, "flex items-center gap-3")}
    >
      {(handle) => (
        <>
          {handle}
          {/* Dirección del saldo: baja (pago) o sube (compra, avance, cargo) */}
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              lowersBalance(entry)
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.danger
            )}
          >
            {lowersBalance(entry) ? (
              <ArrowDown className="size-4" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{title}</span>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  lowersBalance(entry)
                    ? TONE_TEXT_CLASSES.success
                    : TONE_TEXT_CLASSES.danger
                )}
              >
                <Amount
                  value={
                    lowersBalance(entry)
                      ? -Math.abs(entry.amount)
                      : Math.abs(entry.amount)
                  }
                  currency={currency}
                  signed
                />
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">
                {label}
                {isFee && entry.generated && " automática"}
                {` · ${formatShortDate(entry.occurred_on)}`}
                {entry.occurred_time && ` · ${formatTime(entry.occurred_time)}`}
                {accountText && ` · ${accountText}`}
                {installmentsText && ` · ${installmentsText}`}
              </span>
              {entry.transaction_id && (
                <Tooltip>
                  <TooltipTrigger
                    delay={500}
                    aria-label="Tiene un movimiento enlazado"
                    className="touch-hitbox shrink-0 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Link2 className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Tiene un movimiento enlazado</TooltipContent>
                </Tooltip>
              )}
            </span>
            {note && (
              <span className="line-clamp-2 text-xs break-words text-muted-foreground">
                {note}
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
                  ...(canDuplicate
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
              {duplicating && collectable && duplicatePeriod && (
                <ReceivableCollectDialog
                  workspaceId={entry.workspace_id}
                  receivable={collectable}
                  periodOn={duplicatePeriod.period_on}
                  accounts={accounts ?? []}
                  open
                  onOpenChange={setDuplicating}
                />
              )}
              {duplicating && !isMonthlyCollect && (
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
                <p className="text-sm text-muted-foreground">
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
