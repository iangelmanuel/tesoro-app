"use client"

import { useEffect, useState } from "react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import {
  DetailSection,
  DetailSheet,
  DetailStats
} from "@/components/dashboard/detail-sheet"
import {
  SortableListItem,
  SortableListProvider,
  moveItem,
  useSortableList
} from "@/components/dashboard/sortable-list"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import {
  TONE_BADGE_CLASSES,
  TONE_TEXT_CLASSES
} from "@/components/dashboard/tone"
import { ToneBadge } from "@/components/dashboard/tone-badge"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { moveLedgerEntry } from "@/features/transactions/actions"
import { RecordedPaymentActions } from "@/features/transactions/components/recorded-payment-actions"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { cn } from "@/libs/cn"
import { todayISO } from "@/libs/dates"
import { formatDate, formatShortDate } from "@/libs/format"
import { loadRecurringIncomeHistory } from "../actions"
import {
  incomeFrequencyLabel,
  incomeHistoryPageSize,
  shortOccurrenceDate
} from "../occurrences"
import type {
  IncomeHistoryRow,
  IncomeReceipt,
  IncomeSourceOption,
  RecurringIncome,
  RecurringIncomeHistory
} from "../queries"
import { IncomeStatusBadge, PartialDetail } from "./income-status"
import { receiveIncomeInitialValues } from "./receive-income-button"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import { useRecurringIncomeActions } from "./use-recurring-income-actions"

interface RecurringIncomeSheetProps {
  income: RecurringIncome
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Ingresos fijos activos: **Recibir** solo si la fuente está entre ellos */
  incomeSources: IncomeSourceOption[]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de un ingreso fijo (SPEC 38): datos, acciones y sus ocurrencias
 * desde `starts_on` hasta hoy más la próxima, la más reciente primero, con lo
 * recibido, los movimientos que cubren cada una y **Recibir** en las
 * abiertas. Muestra una página (12, o 31 en la diaria) y "Ver más".
 */
export function RecurringIncomeSheet({
  income,
  categories,
  accounts,
  incomeSources,
  currency,
  open,
  onOpenChange
}: RecurringIncomeSheetProps) {
  const pageSize = incomeHistoryPageSize(income.frequency)
  const [limit, setLimit] = useState(pageSize)
  // Sube tras registrar un cobro para volver a pedir el historial
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<RecurringIncomeHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [receiving, setReceiving] = useState<IncomeHistoryRow | null>(null)
  const { pending, toggle, remove } = useRecurringIncomeActions(income)
  const hasSchedule = income.frequency !== "none"
  // Pausada o terminada: el servidor no acepta cobros nuevos para ella
  const source = incomeSources.find((option) => option.id === income.id)
  const canReceive = source !== undefined
  // Duplicar un cobro (SPEC 49) necesita un periodo abierto donde repartirse
  const canDuplicate =
    source !== undefined &&
    (source.frequency === "none" ||
      source.periods.some((period) => period.due > 0))

  // Se pide al abrir, con "Ver más", tras un cobro y al editar
  useEffect(() => {
    if (!open || !hasSchedule) {
      return
    }
    let active = true
    loadRecurringIncomeHistory(income.id, limit).then((result) => {
      if (!active) {
        return
      }
      if (result.error !== undefined) {
        setError(result.error)
      } else {
        setError(null)
        setHistory(result.data)
      }
    })
    return () => {
      active = false
    }
  }, [open, hasSchedule, income.id, income.updated_at, limit, version])

  const year = todayISO().slice(0, 4)
  // La ocurrencia abierta más antigua: las atrasadas primero (la lista va de
  // la más reciente a la más antigua)
  const nextOpen =
    history?.occurrences.findLast((row) => row.status !== "received") ?? null

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={income.name}
        status={
          <ToneBadge
            className={
              income.is_active
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.neutral
            }
          >
            {income.is_active ? "Activo" : "Pausado"}
          </ToneBadge>
        }
        figure={
          <Amount
            value={income.amount}
            currency={currency}
          />
        }
        figureCaption={incomeFrequencyLabel(income)}
        loading={hasSchedule && error === null && history === null}
        summary={
          hasSchedule &&
          (error !== null ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            history && (
              <DetailStats
                items={[
                  {
                    label: `Recibido en ${year}`,
                    value: (
                      <Amount
                        value={history.receivedThisYear}
                        currency={currency}
                      />
                    ),
                    className: TONE_TEXT_CLASSES.success
                  },
                  {
                    label: "Por cobrar a la fecha",
                    value: (
                      <Amount
                        value={history.dueToDate}
                        currency={currency}
                      />
                    ),
                    className:
                      history.dueToDate > 0
                        ? TONE_TEXT_CLASSES.danger
                        : undefined
                  },
                  {
                    label: "Próximo por recibir",
                    value: nextOpen ? (
                      <>
                        {shortOccurrenceDate(nextOpen.dueOn)} ·{" "}
                        <Amount
                          value={nextOpen.remaining}
                          currency={currency}
                        />
                      </>
                    ) : (
                      "Al día"
                    )
                  }
                ]}
              />
            )
          ))
        }
        action={
          !income.is_active ? (
            <Button
              disabled={pending}
              onClick={toggle}
            >
              <Play />
              Reanudar
            </Button>
          ) : (
            canReceive &&
            nextOpen && (
              <Button onClick={() => setReceiving(nextOpen)}>
                <Check />
                Recibir {shortOccurrenceDate(nextOpen.dueOn)}
              </Button>
            )
          )
        }
        history={
          hasSchedule &&
          history && (
            <DetailSection
              title="Periodos"
              help="multipleReceipts"
            >
              <HistoryList
                history={history}
                currency={currency}
                receipts={{
                  workspaceId: income.workspace_id,
                  categories,
                  accounts,
                  incomeSources,
                  canDuplicate,
                  onChanged: () => setVersion((value) => value + 1)
                }}
                onReceive={canReceive ? setReceiving : undefined}
                onShowMore={() => setLimit((value) => value + pageSize)}
              />
            </DetailSection>
          )
        }
        details={
          <DetailSection
            title="Detalles"
            help={hasSchedule ? "frequency" : "noFixedDate"}
          >
            <IncomeDetails income={income} />
          </DetailSection>
        }
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <Pencil />
              Editar
            </Button>
            {income.is_active && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={toggle}
              >
                <Pause />
                Pausar
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setDeleting(true)}
            >
              <Trash2 />
              Eliminar
            </Button>
          </>
        }
      />

      <RecurringIncomeDialog
        workspaceId={income.workspace_id}
        categories={categories}
        accounts={accounts}
        income={income}
        open={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar este ingreso fijo?"
        onConfirm={() => remove(() => onOpenChange(false))}
      >
        <p className="text-sm text-muted-foreground">
          &ldquo;{income.name}&rdquo; dejará de aparecer en tus próximos
          ingresos y en el registro de ingresos. Los movimientos que ya
          registraste se conservan en Movimientos.
        </p>
      </DeleteDialog>
      {receiving && (
        <TransactionDialog
          workspaceId={income.workspace_id}
          categories={categories}
          accounts={accounts}
          incomeSources={incomeSources}
          initialValues={receiveIncomeInitialValues(
            {
              recurringIncomeId: income.id,
              name: income.name,
              amount: income.amount,
              categoryId: income.category_id,
              accountId: income.account_id,
              dueOn: receiving.dueOn
            },
            accounts,
            incomeSources
          )}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setReceiving(null)
              setVersion((value) => value + 1)
            }
          }}
        />
      )}
    </>
  )
}

function IncomeDetails({ income }: { income: RecurringIncome }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Categoría</dt>
      <dd className="min-w-0">
        <CategoryBadge
          name={
            income.category.archived_at
              ? `${income.category.name} (archivada)`
              : income.category.name
          }
          icon={income.category.icon}
          color={income.category.color}
        />
      </dd>
      <dt className="text-muted-foreground">Frecuencia</dt>
      <dd>{incomeFrequencyLabel(income)}</dd>
      <dt className="text-muted-foreground">Cuenta</dt>
      <dd>{income.accountName ?? "Sin cuenta"}</dd>
      <dt className="text-muted-foreground">Vigencia</dt>
      <dd>
        {income.ends_on
          ? `${formatDate(income.starts_on)} – ${formatDate(income.ends_on)}`
          : `Desde ${formatDate(income.starts_on)}`}
      </dd>
    </dl>
  )
}

/** Lo que necesitan Editar, Duplicar y Eliminar de un cobro registrado (SPEC 42 y 49) */
interface ReceiptEditing {
  workspaceId: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources: IncomeSourceOption[]
  /** Queda un periodo abierto donde repartir el duplicado */
  canDuplicate: boolean
  onChanged: () => void
}

function HistoryList({
  history,
  currency,
  receipts,
  onReceive,
  onShowMore
}: {
  history: RecurringIncomeHistory
  currency: string
  receipts: ReceiptEditing
  /** Sin él (fuente pausada) no se muestra **Recibir** */
  onReceive?: (row: IncomeHistoryRow) => void
  onShowMore: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {history.occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no tiene periodos: empieza más adelante.
        </p>
      ) : (
        <ul className={CARD_LIST}>
          {history.occurrences.map((row) => (
            <HistoryRow
              key={row.dueOn}
              row={row}
              currency={currency}
              editing={receipts}
              onReceive={onReceive}
            />
          ))}
        </ul>
      )}

      {history.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onShowMore}
        >
          Ver más
        </Button>
      )}
    </div>
  )
}

function HistoryRow({
  row,
  currency,
  editing,
  onReceive
}: {
  row: IncomeHistoryRow
  currency: string
  editing: ReceiptEditing
  onReceive?: (row: IncomeHistoryRow) => void
}) {
  const isReceived = row.status === "received"

  return (
    <li className={cn(CARD_ROW, "flex flex-col gap-2")}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium first-letter:uppercase">
              {shortOccurrenceDate(row.dueOn)}
            </span>
            <IncomeStatusBadge status={row.status} />
          </div>
          {row.status === "partial" && (
            <p className="text-xs text-muted-foreground">
              <PartialDetail
                received={row.receivedAmount}
                expected={row.amount}
                remaining={row.remaining}
                currency={currency}
              />
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isReceived ? (
            <span
              className={cn("text-sm font-medium", TONE_TEXT_CLASSES.success)}
            >
              <Amount
                value={row.receivedAmount}
                currency={currency}
              />
            </span>
          ) : (
            onReceive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReceive(row)}
              >
                <Check />
                Recibir
              </Button>
            )
          )}
        </div>
      </div>

      {/* Movimientos que cubren la ocurrencia (un cobro puede cubrir
          varias). Cada uno se edita o elimina aparte (SPEC 42) */}
      {row.receipts.length > 0 && (
        <ReceiptsList
          // Otra lista del servidor (recarga del historial) reinicia el orden
          key={row.receipts.map((receipt) => receipt.transactionId).join()}
          receipts={row.receipts}
          currency={currency}
          editing={editing}
        />
      )}
    </li>
  )
}

/**
 * Movimientos que cubren una ocurrencia (un cobro puede cubrir varias). Cada
 * uno se edita o elimina aparte (SPEC 42) y los del mismo día se reordenan
 * como en Movimientos (SPEC 45)
 */
function ReceiptsList({
  receipts,
  currency,
  editing
}: {
  receipts: IncomeReceipt[]
  currency: string
  editing: ReceiptEditing
}) {
  // El historial se carga en el cliente: el orden guardado se queda aquí
  // sin esperar a recargarlo
  const [items, setItems] = useState(receipts)
  const getId = (receipt: IncomeReceipt) => receipt.transactionId
  const sortable = useSortableList({
    items,
    getId,
    getGroup: (receipt) => receipt.occurredOn,
    getTitle: (receipt) => receipt.description,
    handleLabel: "Reordenar dentro del día",
    onMove: async (source, target) => {
      const result = await moveLedgerEntry(
        editing.workspaceId,
        "income",
        source.transactionId,
        "income",
        target.transactionId
      )
      if (!result.error) {
        setItems((current) =>
          moveItem(current, getId, source.transactionId, target.transactionId)
        )
      }
      return result
    }
  })

  return (
    <SortableListProvider {...sortable.providerProps}>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {sortable.items.map((receipt) => (
          <SortableListItem
            key={receipt.transactionId}
            config={sortable.configFor(receipt)}
            className="flex items-center justify-between gap-2 rounded-lg tabular-nums"
          >
            {(handle) => (
              <>
                <span className="flex min-w-0 items-center gap-1">
                  {handle}
                  <span className="min-w-0">
                    {receipt.description} ·{" "}
                    {formatShortDate(receipt.occurredOn)} ·{" "}
                    <Amount
                      value={receipt.amount}
                      currency={currency}
                    />
                  </span>
                </span>
                <RecordedPaymentActions
                  {...editing}
                  transactionId={receipt.transactionId}
                  noun="cobro"
                  deleteEffect={
                    receipts.length > 1
                      ? "el periodo queda parcial con los demás cobros"
                      : "el periodo vuelve a quedar por recibir"
                  }
                />
              </>
            )}
          </SortableListItem>
        ))}
      </ul>
    </SortableListProvider>
  )
}
