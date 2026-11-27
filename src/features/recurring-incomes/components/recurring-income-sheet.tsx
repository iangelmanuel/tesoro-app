"use client"

import { Suspense, useState } from "react"
import { Amount } from "@/components/dashboard/data/amount"
import { DeleteDialog } from "@/components/dashboard/overlays/delete-dialog"
import {
  DetailSheet,
  DetailSheetSkeleton
} from "@/components/dashboard/overlays/detail-sheet"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { ActiveStatusBadge } from "@/features/recurring-expenses/components/active-status-badge"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { type IncomeHistoryRow, nextOpenOccurrence } from "../income-history"
import { incomeFrequencyLabel } from "../occurrences"
import type { IncomeSourceOption, RecurringIncome } from "../queries"
import { receiveIncomeInitialValues } from "./receive-income-button"
import { RecurringIncomeDialog } from "./recurring-income-dialog"
import { useRecurringIncomeActions } from "./use-recurring-income-actions"
import { useRecurringIncomeSheet } from "./use-recurring-income-sheet"

// Resumen, periodos, detalles y acciones se descargan al abrir el panel o al
// pasar por su fila (SPEC 57)
const RecurringIncomeSheetBody = lazyWithPreload(() =>
  import("./recurring-income-sheet-body").then(
    (m) => m.RecurringIncomeSheetBody
  )
)

/** Precarga el cuerpo del Sheet de ingreso fijo: `onPointerEnter` / `onFocus` */
export const preloadRecurringIncomeSheet = RecurringIncomeSheetBody.preload

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
 * abiertas. Muestra una página (12, o 31 en la diaria) y "Ver más". La
 * cabecera, el historial cargado y los diálogos viven aquí y sobreviven al
 * cerrar; el cuerpo es diferido (RecurringIncomeSheetBody)
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
  const source = incomeSources.find((option) => option.id === income.id)
  const nextOpen = history ? nextOpenOccurrence(history.occurrences) : null
  const loading = hasSchedule && error === null && history === null

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
        loading={loading}
        details={
          // Mientras baja el chunk, el skeleton del panel, salvo que ya lo
          // pinte DetailSheet porque el historial también está cargando
          <Suspense fallback={loading ? null : <DetailSheetSkeleton />}>
            <RecurringIncomeSheetBody.Component
              income={income}
              categories={categories}
              accounts={accounts}
              incomeSources={incomeSources}
              source={source}
              currency={currency}
              hasSchedule={hasSchedule}
              loading={loading}
              history={history}
              error={error}
              nextOpen={nextOpen}
              pending={pending}
              onToggle={toggle}
              onReceive={setReceiving}
              onEdit={() => setEditing(true)}
              onDelete={() => setDeleting(true)}
              onReload={reload}
              onShowMore={showMore}
            />
          </Suspense>
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
