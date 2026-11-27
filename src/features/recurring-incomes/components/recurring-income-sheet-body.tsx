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
import { todayISO } from "@/libs/dates"
import type {
  IncomeHistoryRow,
  RecurringIncomeHistory
} from "../income-history"
import { shortOccurrenceDate } from "../occurrences"
import type { IncomeSourceOption, RecurringIncome } from "../queries"
import { canDuplicateReceipt } from "../receipt"
import { RecurringIncomeSheetDetails } from "./recurring-income-sheet-details"
import { RecurringIncomeSheetHistory } from "./recurring-income-sheet-history"

export interface RecurringIncomeSheetBodyProps {
  income: RecurringIncome
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources: IncomeSourceOption[]
  /** La fuente entre los ingresos activos: con ella se puede recibir */
  source: IncomeSourceOption | undefined
  currency: string
  /** Tiene fechas (no "Sin fecha fija"): lleva resumen e historial */
  hasSchedule: boolean
  /** El historial se está pidiendo: DetailSheet ya pinta su skeleton */
  loading: boolean
  history: RecurringIncomeHistory | null
  error: string | null
  nextOpen: IncomeHistoryRow | null
  /** Pausar, reanudar o eliminar en curso */
  pending: boolean
  onToggle: () => void
  onReceive: (row: IncomeHistoryRow) => void
  onEdit: () => void
  onDelete: () => void
  onReload: () => void
  onShowMore: () => void
}

/**
 * Cuerpo del Sheet de un ingreso fijo (SPEC 57): resumen, acción, periodos,
 * detalles y acciones de edición, en el orden de DetailSheet. Va en su slot
 * `details`, que se pinta también mientras carga el historial: entonces solo
 * muestra detalles y acciones, bajo el skeleton del panel. El estado (el
 * historial, "Ver más" y los diálogos) vive en RecurringIncomeSheet
 */
export function RecurringIncomeSheetBody({
  income,
  categories,
  accounts,
  incomeSources,
  source,
  currency,
  hasSchedule,
  loading,
  history,
  error,
  nextOpen,
  pending,
  onToggle,
  onReceive,
  onEdit,
  onDelete,
  onReload,
  onShowMore
}: RecurringIncomeSheetBodyProps) {
  // Pausada o terminada: el servidor no acepta cobros nuevos para ella
  const canReceive = source !== undefined

  let action: ReactNode = null
  if (!income.is_active) {
    action = (
      <Button
        disabled={pending}
        onClick={onToggle}
      >
        <Play />
        Reanudar
      </Button>
    )
  } else if (canReceive && nextOpen) {
    action = (
      <Button onClick={() => onReceive(nextOpen)}>
        <Check />
        Recibir {shortOccurrenceDate(nextOpen.dueOn)}
      </Button>
    )
  }

  return (
    <>
      {!loading && (
        <>
          {hasSchedule && (
            <SheetSummary
              error={error}
              history={history}
              nextOpen={nextOpen}
              year={todayISO().slice(0, 4)}
              currency={currency}
            />
          )}
          {/* Misma caja que el slot `action` de DetailSheet */}
          {action && <div className="flex flex-col gap-2">{action}</div>}
          {hasSchedule && history && (
            <DetailSection
              title="Periodos"
              help="multipleReceipts"
            >
              <RecurringIncomeSheetHistory
                history={history}
                currency={currency}
                editing={{
                  workspaceId: income.workspace_id,
                  categories,
                  accounts,
                  incomeSources,
                  canDuplicate: canDuplicateReceipt(source),
                  onChanged: onReload
                }}
                onReceive={canReceive ? onReceive : undefined}
                onShowMore={onShowMore}
              />
            </DetailSection>
          )}
        </>
      )}

      <DetailSection
        title="Detalles"
        help={hasSchedule ? "frequency" : "noFixedDate"}
      >
        <RecurringIncomeSheetDetails income={income} />
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
        {income.is_active && (
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
 * Resumen bajo la cifra: el error de carga o los totales del historial (nada
 * mientras carga)
 */
function SheetSummary({
  error,
  history,
  nextOpen,
  year,
  currency
}: {
  error: string | null
  history: RecurringIncomeHistory | null
  nextOpen: IncomeHistoryRow | null
  year: string
  currency: string
}) {
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
            history.dueToDate > 0 ? TONE_TEXT_CLASSES.danger : undefined
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
}
