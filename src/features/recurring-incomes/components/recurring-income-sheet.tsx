"use client"

import { useEffect, useState } from "react"
import { Button, Chip, Drawer, Skeleton, cn } from "@heroui/react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/amount"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { useIsMobile } from "@/hooks/use-is-mobile"
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
  const isMobile = useIsMobile()
  const hasSchedule = income.frequency !== "none"
  // Pausada o terminada: el servidor no acepta cobros nuevos para ella
  const canReceive = incomeSources.some((source) => source.id === income.id)

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

  return (
    <>
      <Drawer
        isOpen={open}
        onOpenChange={onOpenChange}
      >
        <Drawer.Backdrop>
          {/* < 768 px: hoja inferior con asa, como los demás Sheets móviles */}
          <Drawer.Content placement={isMobile ? "bottom" : "right"}>
            <Drawer.Dialog
              className={
                isMobile
                  ? "max-h-[90dvh] pb-[env(safe-area-inset-bottom)]"
                  : "w-full sm:max-w-md"
              }
            >
              {isMobile && <Drawer.Handle />}
              <Drawer.CloseTrigger aria-label="Cerrar" />
              <Drawer.Header>
                <div className="flex flex-wrap items-center gap-2">
                  <Drawer.Heading className="truncate">
                    {income.name}
                  </Drawer.Heading>
                  {income.is_active ? (
                    <Chip size="sm">Activo</Chip>
                  ) : (
                    <Chip
                      size="sm"
                      variant="tertiary"
                    >
                      Pausado
                    </Chip>
                  )}
                </div>
                <p className="text-sm text-muted tabular-nums">
                  <span className="font-medium text-foreground">
                    <Amount
                      value={income.amount}
                      currency={currency}
                    />
                  </span>{" "}
                  · {incomeFrequencyLabel(income)}
                </p>
              </Drawer.Header>
              <Drawer.Body>
                <div className="flex flex-col gap-6">
                  <IncomeDetails income={income} />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="max-md:min-h-11"
                      onPress={() => setEditing(true)}
                    >
                      <Pencil />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="max-md:min-h-11"
                      isDisabled={pending}
                      onPress={toggle}
                    >
                      {income.is_active ? <Pause /> : <Play />}
                      {income.is_active ? "Pausar" : "Reanudar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-soft"
                      className="max-md:min-h-11"
                      isDisabled={pending}
                      onPress={() => setDeleting(true)}
                    >
                      <Trash2 />
                      Eliminar
                    </Button>
                  </div>

                  {hasSchedule && (
                    <section
                      aria-label="Ocurrencias"
                      className="flex flex-col gap-3"
                    >
                      <h3 className="text-xs font-medium text-muted uppercase">
                        Ocurrencias
                      </h3>
                      {error !== null ? (
                        <p className="text-sm text-danger">{error}</p>
                      ) : history === null ? (
                        <HistorySkeleton />
                      ) : (
                        <HistoryList
                          history={history}
                          currency={currency}
                          onReceive={canReceive ? setReceiving : undefined}
                          onShowMore={() =>
                            setLimit((value) => value + pageSize)
                          }
                        />
                      )}
                    </section>
                  )}
                </div>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

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
        <p className="text-sm text-muted">
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
      <dt className="text-muted">Categoría</dt>
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
      <dt className="text-muted">Frecuencia</dt>
      <dd>{incomeFrequencyLabel(income)}</dd>
      <dt className="text-muted">Cuenta</dt>
      <dd>{income.accountName ?? "Sin cuenta"}</dd>
      <dt className="text-muted">Vigencia</dt>
      <dd>
        {income.ends_on
          ? `${formatDate(income.starts_on)} – ${formatDate(income.ends_on)}`
          : `Desde ${formatDate(income.starts_on)}`}
      </dd>
    </dl>
  )
}

function HistoryList({
  history,
  currency,
  onReceive,
  onShowMore
}: {
  history: RecurringIncomeHistory
  currency: string
  /** Sin él (fuente pausada) no se muestra **Recibir** */
  onReceive?: (row: IncomeHistoryRow) => void
  onShowMore: () => void
}) {
  // Mismo año que usa la query (America/Bogota)
  const year = todayISO().slice(0, 4)

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">Recibido en {year}</dt>
          <dd className="font-medium text-(--income)">
            <Amount
              value={history.receivedThisYear}
              currency={currency}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">Por cobrar a la fecha</dt>
          <dd
            className={cn(
              "font-medium",
              history.dueToDate > 0 && "text-(--expense)"
            )}
          >
            <Amount
              value={history.dueToDate}
              currency={currency}
            />
          </dd>
        </div>
      </dl>

      {history.occurrences.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no tiene ocurrencias: empieza más adelante.
        </p>
      ) : (
        <ul className={CARD_LIST}>
          {history.occurrences.map((row) => (
            <HistoryRow
              key={row.dueOn}
              row={row}
              currency={currency}
              onReceive={onReceive}
            />
          ))}
        </ul>
      )}

      {history.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start max-md:min-h-11"
          onPress={onShowMore}
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
  onReceive
}: {
  row: IncomeHistoryRow
  currency: string
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
            <p className="text-xs text-muted">
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
            <span className="text-sm font-medium text-(--income)">
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
                className="max-md:min-h-11"
                onPress={() => onReceive(row)}
              >
                <Check />
                Recibir
              </Button>
            )
          )}
        </div>
      </div>

      {/* Movimientos que cubren la ocurrencia (un cobro puede cubrir varias) */}
      {row.receipts.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted">
          {row.receipts.map((receipt) => (
            <li
              key={receipt.transactionId}
              className="tabular-nums"
            >
              {receipt.description} · {formatShortDate(receipt.occurredOn)} ·{" "}
              <Amount
                value={receipt.amount}
                currency={currency}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}
