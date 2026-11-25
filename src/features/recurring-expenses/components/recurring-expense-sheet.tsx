"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
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
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { currentMonth } from "@/libs/dates"
import { formatShortDate } from "@/libs/format"
import { frequencyLabel } from "../occurrences"
import type {
  RecurringExpense,
  RecurringExpenseHistory,
  UpcomingPayment
} from "../queries"
import {
  hasFutureOccurrences,
  nextUnpaidPayment,
  periodLabel
} from "../recurring-expense-history"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import { RecurringExpenseSheetDetails } from "./recurring-expense-sheet-details"
import { RecurringExpenseSheetHistory } from "./recurring-expense-sheet-history"
import { occurrencePaymentProps } from "./upcoming-payments"
import { useRecurringExpenseActions } from "./use-recurring-expense-actions"
import { useRecurringExpenseSheet } from "./use-recurring-expense-sheet"

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
  const { history, error, reload, showMore } = useRecurringExpenseSheet(
    expense,
    open
  )
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paying, setPaying] = useState<UpcomingPayment | null>(null)
  const { pending, toggle, remove } = useRecurringExpenseActions(expense)

  const isYearly = expense.frequency === "yearly"
  const month = currentMonth()
  const nextUnpaid = history ? nextUnpaidPayment(history.payments) : null

  let action: ReactNode = null
  if (!expense.is_active) {
    action = (
      <Button
        disabled={pending}
        onClick={toggle}
      >
        <Play />
        Reanudar
      </Button>
    )
  } else if (nextUnpaid) {
    action = (
      <Button onClick={() => setPaying(nextUnpaid)}>
        <Check />
        Marcar {periodLabel(nextUnpaid, isYearly)} como pagado
      </Button>
    )
  }

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
          <SheetSummary
            isActive={expense.is_active}
            error={error}
            history={history}
            nextUnpaid={nextUnpaid}
            isYearly={isYearly}
            year={month.slice(0, 4)}
            currency={currency}
          />
        }
        action={action}
        history={
          expense.is_active &&
          history && (
            <DetailSection
              title={isYearly ? "Pagos por año" : "Pagos mes a mes"}
            >
              <RecurringExpenseSheetHistory
                history={history}
                isYearly={isYearly}
                currency={currency}
                hasFutureOccurrences={hasFutureOccurrences(expense, month)}
                payments={{
                  workspaceId: expense.workspace_id,
                  categories,
                  accounts,
                  onChanged: reload
                }}
                onPay={setPaying}
                onShowMore={showMore}
              />
            </DetailSection>
          )
        }
        details={
          <DetailSection
            title="Detalles"
            help="frequency"
          >
            <RecurringExpenseSheetDetails expense={expense} />
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
              reload()
            }
          }}
        />
      )}
    </>
  )
}

/**
 * Resumen bajo la cifra: aviso de pausado, el error de carga o los totales
 * del historial (nada mientras carga)
 */
function SheetSummary({
  isActive,
  error,
  history,
  nextUnpaid,
  isYearly,
  year,
  currency
}: {
  isActive: boolean
  error: string | null
  history: RecurringExpenseHistory | null
  nextUnpaid: UpcomingPayment | null
  isYearly: boolean
  year: string
  currency: string
}) {
  if (!isActive) {
    return (
      <p className="text-sm text-muted-foreground">
        Este gasto está pausado: no genera pagos. Reanúdalo para ver su
        historial.
      </p>
    )
  }
  if (error !== null) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!history) {
    return null
  }

  return (
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
            history.overdueAmount > 0 ? TONE_TEXT_CLASSES.danger : undefined
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
}
