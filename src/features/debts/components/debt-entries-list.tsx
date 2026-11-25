"use client"

import { useState, useTransition } from "react"
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Link2,
  Pencil,
  Receipt,
  Trash2
} from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { RowActions } from "@/components/dashboard/data/row-actions"
import {
  type SortableConfig,
  SortableListItem,
  SortableListProvider,
  useSortableList
} from "@/components/dashboard/data/sortable-list"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { CardEmpty } from "@/components/dashboard/feedback/empty-state"
import {
  TONE_BADGE_CLASSES,
  TONE_TEXT_CLASSES
} from "@/components/dashboard/feedback/tone"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import { toast } from "@/components/ui/sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { cn } from "@/libs/cn"
import { formatDate, formatShortDate, formatTime } from "@/libs/format"
import { formatMonthYear } from "../calculations"
import { deleteEntry, moveDebtEntry } from "../entry-actions"
import { installmentLabel, installmentProgress } from "../installments"
import type { Debt, DebtEntry } from "../queries"
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
  /**
   * Me deben mensual: sus cuotas, para que el duplicado de un cobro cubra la
   * siguiente pendiente (SPEC 49)
   */
  collectable?: CollectableReceivable
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
  collectable,
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
      {/* Como un extracto: por mes, del más reciente al más antiguo. El orden
          manual es dentro del día, así que nunca cruza de un mes a otro */}
      <div className="flex flex-col gap-5">
        {groupByMonth(sortable.items).map(([month, monthEntries]) => (
          <section
            key={month}
            aria-label={formatMonthYear(month)}
            className="flex flex-col gap-2"
          >
            <h4 className="text-xs font-medium text-muted-foreground first-letter:uppercase">
              {formatMonthYear(month)}
            </h4>
            <ul className={CARD_LIST}>
              {monthEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  debt={debt}
                  entry={entry}
                  accounts={accounts}
                  categories={categories}
                  currency={currency}
                  cycleCovered={cycleCovered}
                  collectable={collectable}
                  readOnly={readOnly}
                  sortable={sortable.configFor(entry)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SortableListProvider>
  )
}

/** Movimientos agrupados por mes (YYYY-MM), conservando su orden */
function groupByMonth(entries: DebtEntry[]) {
  const groups = new Map<string, DebtEntry[]>()
  for (const entry of entries) {
    const month = entry.occurred_on.slice(0, 7)
    const group = groups.get(month)
    if (group) {
      group.push(entry)
    } else {
      groups.set(month, [entry])
    }
  }
  return [...groups]
}

function EntryRow({
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
  const [, startTransition] = useTransition()
  const isPayment = entry.kind === "payment"
  const isAdvance = entry.kind === "advance"
  const isFee = entry.kind === "fee"
  // Compra o avance (SPEC 42): con cuenta es un avance; sin ella, una compra
  const isPurchase = isAdvance && entry.payment_account_id === null
  const label = entryLabel(debt, entry)
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
        toast.error(result.error)
      } else {
        toast.success(`${label} ${feminine ? "eliminada" : "eliminado"}`)
      }
    })
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
              lowersBalance
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.danger
            )}
          >
            {lowersBalance ? (
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
                  lowersBalance
                    ? TONE_TEXT_CLASSES.success
                    : TONE_TEXT_CLASSES.danger
                )}
              >
                <Amount
                  value={
                    lowersBalance
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
