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
import { formatMonthYear } from "@/features/debts/calculations"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { currentMonth } from "@/libs/dates"
import { formatDate, formatShortDate } from "@/libs/format"
import { loadRecurringExpenseHistory } from "../actions"
import { frequencyLabel } from "../occurrences"
import {
  HISTORY_PAGE_SIZE,
  type RecurringExpense,
  type RecurringExpenseHistory,
  type UpcomingPayment
} from "../queries"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import {
  OccurrenceStatusBadge,
  occurrencePaymentProps
} from "./upcoming-payments"
import { useRecurringExpenseActions } from "./use-recurring-expense-actions"

interface RecurringExpenseSheetProps {
  expense: RecurringExpense
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de un gasto fijo (SPEC 37): datos, acciones y sus periodos desde
 * `starts_on` hasta el mes actual, el más reciente primero, con "Marcar como
 * pagado" en los impagos. Muestra los últimos 12 y un "Ver más".
 */
export function RecurringExpenseSheet({
  expense,
  categories,
  accounts,
  currency,
  open,
  onOpenChange
}: RecurringExpenseSheetProps) {
  const [limit, setLimit] = useState(HISTORY_PAGE_SIZE)
  // Sube tras registrar un pago para volver a pedir el historial
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<RecurringExpenseHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState<UpcomingPayment | null>(null)
  const { pending, toggle, remove } = useRecurringExpenseActions(expense)

  // Se pide al abrir, con "Ver más", tras un pago y al pausar o editar
  useEffect(() => {
    if (!open) {
      return
    }
    let active = true
    loadRecurringExpenseHistory(expense.id, limit).then((result) => {
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
  }, [open, expense.id, expense.is_active, expense.updated_at, limit, version])

  const isYearly = expense.frequency === "yearly"
  const isMobile = useIsMobile()

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
                    {expense.name}
                  </Drawer.Heading>
                  {expense.is_active ? (
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
                      value={expense.amount}
                      currency={currency}
                    />
                  </span>{" "}
                  · {frequencyLabel(expense)}
                </p>
              </Drawer.Header>
              <Drawer.Body>
                <div className="flex flex-col gap-6">
                  <ExpenseDetails expense={expense} />

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
                      {expense.is_active ? <Pause /> : <Play />}
                      {expense.is_active ? "Pausar" : "Reanudar"}
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

                  <section
                    aria-label="Pagos por periodo"
                    className="flex flex-col gap-3"
                  >
                    <h3 className="text-xs font-medium text-muted uppercase">
                      {isYearly ? "Pagos por año" : "Pagos mes a mes"}
                    </h3>
                    {!expense.is_active ? (
                      <p className="text-sm text-muted">
                        Este gasto está pausado: no genera pagos. Reanúdalo para
                        ver su historial.
                      </p>
                    ) : error !== null ? (
                      <p className="text-sm text-danger">{error}</p>
                    ) : history === null ? (
                      <HistorySkeleton />
                    ) : (
                      <HistoryList
                        history={history}
                        isYearly={isYearly}
                        currency={currency}
                        onPay={setPaying}
                        onShowMore={() =>
                          setLimit((value) => value + HISTORY_PAGE_SIZE)
                        }
                      />
                    )}
                  </section>
                </div>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <RecurringExpenseDialog
        workspaceId={expense.workspace_id}
        categories={categories}
        expense={expense}
        open={editing}
        onOpenChange={setEditing}
      />
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar este gasto fijo?"
        onConfirm={() => remove(() => onOpenChange(false))}
      >
        <p className="text-sm text-muted">
          &ldquo;{expense.name}&rdquo; dejará de aparecer en tus próximos pagos.
          Los movimientos que ya registraste como pago se conservan en
          Movimientos.
        </p>
      </DeleteDialog>
      {paying && (
        <TransactionDialog
          workspaceId={expense.workspace_id}
          categories={categories}
          accounts={accounts}
          {...occurrencePaymentProps(paying)}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setPaying(null)
              setVersion((value) => value + 1)
            }
          }}
        />
      )}
    </>
  )
}

function ExpenseDetails({ expense }: { expense: RecurringExpense }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted">Categoría</dt>
      <dd className="min-w-0">
        <CategoryBadge
          name={
            expense.category.archived_at
              ? `${expense.category.name} (archivada)`
              : expense.category.name
          }
          icon={expense.category.icon}
          color={expense.category.color}
        />
      </dd>
      <dt className="text-muted">Frecuencia</dt>
      <dd>{frequencyLabel(expense)}</dd>
      <dt className="text-muted">Vigencia</dt>
      <dd>
        {expense.ends_on
          ? `${formatDate(expense.starts_on)} – ${formatDate(expense.ends_on)}`
          : `Desde ${formatDate(expense.starts_on)}`}
      </dd>
    </dl>
  )
}

function HistoryList({
  history,
  isYearly,
  currency,
  onPay,
  onShowMore
}: {
  history: RecurringExpenseHistory
  isYearly: boolean
  currency: string
  onPay: (payment: UpcomingPayment) => void
  onShowMore: () => void
}) {
  // Mismo año que usa la query (America/Bogota)
  const year = currentMonth().slice(0, 4)

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">Pagado en {year}</dt>
          <dd className="font-medium text-(--income)">
            <Amount
              value={history.paidThisYear}
              currency={currency}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted">Atrasado a la fecha</dt>
          <dd
            className={cn(
              "font-medium",
              history.overdueAmount > 0 && "text-(--expense)"
            )}
          >
            <Amount
              value={history.overdueAmount}
              currency={currency}
            />
          </dd>
        </div>
      </dl>

      {history.payments.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no tiene periodos: empieza más adelante.
        </p>
      ) : (
        <ul className={CARD_LIST}>
          {history.payments.map((payment) => (
            <HistoryRow
              key={payment.dueOn}
              payment={payment}
              isYearly={isYearly}
              currency={currency}
              onPay={onPay}
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
  payment,
  isYearly,
  currency,
  onPay
}: {
  payment: UpcomingPayment
  isYearly: boolean
  currency: string
  onPay: (payment: UpcomingPayment) => void
}) {
  const period = isYearly
    ? payment.dueOn.slice(0, 4)
    : formatMonthYear(payment.dueOn.slice(0, 7))
  const isPaid = payment.transactionId !== null

  return (
    <li
      className={cn(
        CARD_ROW,
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium first-letter:uppercase">
            {period}
          </span>
          <OccurrenceStatusBadge status={payment.status} />
        </div>
        <p className="text-xs text-muted tabular-nums">
          {isPaid && payment.paidOn !== null
            ? `Pagado el ${formatShortDate(payment.paidOn)} · vencía el ${formatShortDate(payment.dueOn)}`
            : `Vence el ${formatShortDate(payment.dueOn)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPaid ? (
          <span className="text-sm font-medium text-(--income)">
            <Amount
              value={payment.paidAmount ?? payment.amount}
              currency={currency}
            />
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="max-md:min-h-11"
            onPress={() => onPay(payment)}
          >
            <Check />
            Marcar como pagado
          </Button>
        )}
      </div>
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
