"use client"

import { useEffect, useState } from "react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import {
  TONE_BADGE_CLASSES,
  TONE_TEXT_CLASSES
} from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import {
  DetailSection,
  DetailSheet,
  DetailStats
} from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { formatMonthYear } from "@/features/debts/calculations"
import { RecordedPaymentActions } from "@/features/transactions/components/recorded-payment-actions"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { cn } from "@/libs/cn"
import { currentMonth, monthRange } from "@/libs/dates"
import { formatDate, formatShortDate } from "@/libs/format"
import { loadRecurringExpenseHistory } from "../actions"
import { HISTORY_PAGE_SIZE, frequencyLabel } from "../occurrences"
import type {
  RecurringExpense,
  RecurringExpenseHistory,
  UpcomingPayment
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
  const year = currentMonth().slice(0, 4)
  // El periodo por pagar más antiguo: los atrasados primero (la lista va del
  // más reciente al más antiguo)
  const nextUnpaid =
    history?.payments.findLast((payment) => payment.transactionId === null) ??
    null
  // El historial llega hasta el mes actual: sin fin, o con fin después de
  // este mes, aún quedan ocurrencias futuras por pagar (Duplicar, SPEC 49)
  const hasFutureOccurrences =
    expense.ends_on === null || expense.ends_on > monthRange(currentMonth()).to

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={expense.name}
        status={
          <ToneBadge
            className={
              expense.is_active
                ? TONE_BADGE_CLASSES.success
                : TONE_BADGE_CLASSES.neutral
            }
          >
            {expense.is_active ? "Activo" : "Pausado"}
          </ToneBadge>
        }
        figure={
          <Amount
            value={expense.amount}
            currency={currency}
          />
        }
        figureCaption={frequencyLabel(expense)}
        loading={expense.is_active && error === null && history === null}
        summary={
          !expense.is_active ? (
            <p className="text-sm text-muted-foreground">
              Este gasto está pausado: no genera pagos. Reanúdalo para ver su
              historial.
            </p>
          ) : error !== null ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            history && (
              <DetailStats
                items={[
                  {
                    label: `Pagado en ${year}`,
                    value: (
                      <Amount
                        value={history.paidThisYear}
                        currency={currency}
                      />
                    ),
                    className: TONE_TEXT_CLASSES.success
                  },
                  {
                    label: "Atrasado a la fecha",
                    value: (
                      <Amount
                        value={history.overdueAmount}
                        currency={currency}
                      />
                    ),
                    className:
                      history.overdueAmount > 0
                        ? TONE_TEXT_CLASSES.danger
                        : undefined
                  },
                  {
                    label: "Próximo por pagar",
                    value: nextUnpaid
                      ? `${periodLabel(nextUnpaid, isYearly)} · vence el ${formatShortDate(nextUnpaid.dueOn)}`
                      : "Al día"
                  }
                ]}
              />
            )
          )
        }
        action={
          !expense.is_active ? (
            <Button
              disabled={pending}
              onClick={toggle}
            >
              <Play />
              Reanudar
            </Button>
          ) : (
            nextUnpaid && (
              <Button onClick={() => setPaying(nextUnpaid)}>
                <Check />
                Marcar {periodLabel(nextUnpaid, isYearly)} como pagado
              </Button>
            )
          )
        }
        history={
          expense.is_active &&
          history && (
            <DetailSection
              title={isYearly ? "Pagos por año" : "Pagos mes a mes"}
            >
              <HistoryList
                history={history}
                isYearly={isYearly}
                currency={currency}
                hasFutureOccurrences={hasFutureOccurrences}
                payments={{
                  workspaceId: expense.workspace_id,
                  categories,
                  accounts,
                  onChanged: () => setVersion((value) => value + 1)
                }}
                onPay={setPaying}
                onShowMore={() =>
                  setLimit((value) => value + HISTORY_PAGE_SIZE)
                }
              />
            </DetailSection>
          )
        }
        details={
          <DetailSection
            title="Detalles"
            help="frequency"
          >
            <ExpenseDetails expense={expense} />
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
            {expense.is_active && (
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

      <RecurringExpenseDialog
        workspaceId={expense.workspace_id}
        categories={categories}
        accounts={accounts}
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
        <p className="text-sm text-muted-foreground">
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
          {...occurrencePaymentProps(paying, accounts)}
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
      <dt className="text-muted-foreground">Categoría</dt>
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
      <dt className="text-muted-foreground">Frecuencia</dt>
      <dd>{frequencyLabel(expense)}</dd>
      <dt className="text-muted-foreground">Vigencia</dt>
      <dd>
        {expense.ends_on
          ? `${formatDate(expense.starts_on)} – ${formatDate(expense.ends_on)}`
          : `Desde ${formatDate(expense.starts_on)}`}
      </dd>
    </dl>
  )
}

/** "octubre 2026" o "2026" */
function periodLabel(payment: UpcomingPayment, isYearly: boolean) {
  return isYearly
    ? payment.dueOn.slice(0, 4)
    : formatMonthYear(payment.dueOn.slice(0, 7))
}

/** Lo que necesitan Editar y Eliminar de un pago registrado (SPEC 42) */
interface PaymentEditing {
  workspaceId: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  onChanged: () => void
}

function HistoryList({
  history,
  isYearly,
  currency,
  hasFutureOccurrences,
  payments,
  onPay,
  onShowMore
}: {
  history: RecurringExpenseHistory
  isYearly: boolean
  currency: string
  /** Quedan ocurrencias después del mes actual */
  hasFutureOccurrences: boolean
  payments: PaymentEditing
  onPay: (payment: UpcomingPayment) => void
  onShowMore: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {history.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
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
              // Duplicar paga la siguiente ocurrencia sin pagar: se oculta si
              // no queda ninguna después de esta
              canDuplicate={
                hasFutureOccurrences ||
                history.payments.some(
                  (other) =>
                    other.transactionId === null && other.dueOn > payment.dueOn
                )
              }
              editing={payments}
              onPay={onPay}
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
  payment,
  isYearly,
  currency,
  canDuplicate,
  editing,
  onPay
}: {
  payment: UpcomingPayment
  isYearly: boolean
  currency: string
  canDuplicate: boolean
  editing: PaymentEditing
  onPay: (payment: UpcomingPayment) => void
}) {
  const period = periodLabel(payment, isYearly)
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
        <p className="text-xs text-muted-foreground tabular-nums">
          {isPaid && payment.paidOn !== null
            ? `Pagado el ${formatShortDate(payment.paidOn)} · vencía el ${formatShortDate(payment.dueOn)}`
            : `Vence el ${formatShortDate(payment.dueOn)}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isPaid && payment.transactionId !== null ? (
          <>
            <span
              className={cn("text-sm font-medium", TONE_TEXT_CLASSES.success)}
            >
              <Amount
                value={payment.paidAmount ?? payment.amount}
                currency={currency}
              />
            </span>
            {/* El mismo movimiento que en Movimientos (SPEC 42) */}
            <RecordedPaymentActions
              {...editing}
              transactionId={payment.transactionId}
              noun="pago"
              canDuplicate={canDuplicate}
              deleteEffect={`${period} vuelve a quedar por pagar`}
            />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPay(payment)}
          >
            <Check />
            Marcar como pagado
          </Button>
        )}
      </div>
    </li>
  )
}
