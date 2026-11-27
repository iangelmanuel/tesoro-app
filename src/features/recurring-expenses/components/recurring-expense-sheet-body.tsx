"use client"

import type { ReactNode } from "react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import {
  DetailSection,
  DetailStats
} from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { formatShortDate } from "@/libs/format"
import type {
  RecurringExpense,
  RecurringExpenseHistory,
  UpcomingPayment
} from "../queries"
import { hasFutureOccurrences, periodLabel } from "../recurring-expense-history"
import { RecurringExpenseSheetDetails } from "./recurring-expense-sheet-details"
import { RecurringExpenseSheetHistory } from "./recurring-expense-sheet-history"

export interface RecurringExpenseSheetBodyProps {
  expense: RecurringExpense
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
  /** Mes actual YYYY-MM */
  month: string
  /** El historial se está pidiendo: DetailSheet ya pinta su skeleton */
  loading: boolean
  history: RecurringExpenseHistory | null
  error: string | null
  nextUnpaid: UpcomingPayment | null
  /** Pausar, reanudar o eliminar en curso */
  pending: boolean
  onToggle: () => void
  onPay: (payment: UpcomingPayment) => void
  onEdit: () => void
  onDelete: () => void
  onReload: () => void
  onShowMore: () => void
}

/**
 * Cuerpo del Sheet de un gasto fijo (SPEC 57): resumen, acción, historial,
 * detalles y acciones de edición, en el orden de DetailSheet. Va en su slot
 * `details`, que se pinta también mientras carga el historial: entonces solo
 * muestra detalles y acciones, bajo el skeleton del panel. El estado (el
 * historial, "Ver más" y los diálogos) vive en RecurringExpenseSheet
 */
export function RecurringExpenseSheetBody({
  expense,
  categories,
  accounts,
  currency,
  month,
  loading,
  history,
  error,
  nextUnpaid,
  pending,
  onToggle,
  onPay,
  onEdit,
  onDelete,
  onReload,
  onShowMore
}: RecurringExpenseSheetBodyProps) {
  const isYearly = expense.frequency === "yearly"

  let action: ReactNode = null
  if (!expense.is_active) {
    action = (
      <Button
        disabled={pending}
        onClick={onToggle}
      >
        <Play />
        Reanudar
      </Button>
    )
  } else if (nextUnpaid) {
    action = (
      <Button onClick={() => onPay(nextUnpaid)}>
        <Check />
        Marcar {periodLabel(nextUnpaid, isYearly)} como pagado
      </Button>
    )
  }

  return (
    <>
      {!loading && (
        <>
          <SheetSummary
            isActive={expense.is_active}
            error={error}
            history={history}
            nextUnpaid={nextUnpaid}
            isYearly={isYearly}
            year={month.slice(0, 4)}
            currency={currency}
          />
          {/* Misma caja que el slot `action` de DetailSheet */}
          {action && <div className="flex flex-col gap-2">{action}</div>}
          {expense.is_active && history && (
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
                  onChanged: onReload
                }}
                onPay={onPay}
                onShowMore={onShowMore}
              />
            </DetailSection>
          )}
        </>
      )}

      <DetailSection
        title="Detalles"
        help="frequency"
      >
        <RecurringExpenseSheetDetails expense={expense} />
      </DetailSection>

      {/* Misma caja que el slot `footer` de DetailSheet */}
      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
        >
          <Pencil />
          Editar
        </Button>
        {expense.is_active && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onToggle}
          >
            <Pause />
            Pausar
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 />
          Eliminar
        </Button>
      </div>
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
