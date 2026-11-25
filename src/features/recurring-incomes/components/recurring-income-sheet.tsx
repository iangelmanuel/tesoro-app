"use client"

import { type ReactNode, useState } from "react"
import { Check, Pause, Pencil, Play, Trash2 } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import {
  DetailSection,
  DetailSheet,
  DetailStats
} from "@/components/dashboard/overlays/detail-sheet"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { ActiveStatusBadge } from "@/features/recurring-expenses/components/active-status-badge"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { todayISO } from "@/libs/dates"
import {
  type IncomeHistoryRow,
  type RecurringIncomeHistory,
  nextOpenOccurrence
} from "../income-history"
import { incomeFrequencyLabel, shortOccurrenceDate } from "../occurrences"
import type { IncomeSourceOption, RecurringIncome } from "../queries"
import { canDuplicateReceipt } from "../receipt"
import { receiveIncomeInitialValues } from "./receive-income-button"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import { RecurringIncomeSheetDetails } from "./recurring-income-sheet-details"
import { RecurringIncomeSheetHistory } from "./recurring-income-sheet-history"
import { useRecurringIncomeActions } from "./use-recurring-income-actions"
import { useRecurringIncomeSheet } from "./use-recurring-income-sheet"

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
  const { hasSchedule, history, error, reload, showMore } =
    useRecurringIncomeSheet(income, open)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [receiving, setReceiving] = useState<IncomeHistoryRow | null>(null)
  const { pending, toggle, remove } = useRecurringIncomeActions(income)
  // Pausada o terminada: el servidor no acepta cobros nuevos para ella
  const source = incomeSources.find((option) => option.id === income.id)
  const canReceive = source !== undefined
  const nextOpen = history ? nextOpenOccurrence(history.occurrences) : null

  let action: ReactNode = null
  if (!income.is_active) {
    action = (
      <Button
        disabled={pending}
        onClick={toggle}
      >
        <Play />
        Reanudar
      </Button>
    )
  } else if (canReceive && nextOpen) {
    action = (
      <Button onClick={() => setReceiving(nextOpen)}>
        <Check />
        Recibir {shortOccurrenceDate(nextOpen.dueOn)}
      </Button>
    )
  }

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={income.name}
        status={<ActiveStatusBadge active={income.is_active} />}
        figure={
          <Amount
            value={income.amount}
            currency={currency}
          />
        }
        figureCaption={incomeFrequencyLabel(income)}
        loading={hasSchedule && error === null && history === null}
        summary={
          hasSchedule && (
            <SheetSummary
              error={error}
              history={history}
              nextOpen={nextOpen}
              year={todayISO().slice(0, 4)}
              currency={currency}
            />
          )
        }
        action={action}
        history={
          hasSchedule &&
          history && (
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
                  onChanged: reload
                }}
                onReceive={canReceive ? setReceiving : undefined}
                onShowMore={showMore}
              />
            </DetailSection>
          )
        }
        details={
          <DetailSection
            title="Detalles"
            help={hasSchedule ? "frequency" : "noFixedDate"}
          >
            <RecurringIncomeSheetDetails income={income} />
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
              reload()
            }
          }}
        />
      )}
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
