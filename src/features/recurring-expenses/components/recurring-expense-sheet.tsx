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
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import { currentMonth } from "@/libs/dates"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { frequencyLabel } from "../occurrences"
import type { RecurringExpense, UpcomingPayment } from "../queries"
import { nextUnpaidPayment } from "../recurring-expense-history"
import { ActiveStatusBadge } from "./active-status-badge"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import { occurrencePaymentProps } from "./upcoming-payments"
import { useRecurringExpenseActions } from "./use-recurring-expense-actions"
import { useRecurringExpenseSheet } from "./use-recurring-expense-sheet"

// Resumen, historial de pagos, detalles y acciones se descargan al abrir el
// panel o al pasar por su fila (SPEC 57)
const RecurringExpenseSheetBody = lazyWithPreload(() =>
  import("./recurring-expense-sheet-body").then(
    (m) => m.RecurringExpenseSheetBody
  )
)

/** Precarga el cuerpo del Sheet de gasto fijo: `onPointerEnter` / `onFocus` */
export const preloadRecurringExpenseSheet = RecurringExpenseSheetBody.preload

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
 * pagado" en los impagos. Muestra los últimos 12 y un "Ver más". La
 * cabecera, el historial cargado y los diálogos viven aquí y sobreviven al
 * cerrar; el cuerpo es diferido (RecurringExpenseSheetBody)
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

  const month = currentMonth()
  const nextUnpaid = history ? nextUnpaidPayment(history.payments) : null
  const loading = expense.is_active && error === null && history === null

  return (
    <>
      <DetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={expense.name}
        status={<ActiveStatusBadge active={expense.is_active} />}
        figure={
          <Amount
            value={expense.amount}
            currency={currency}
          />
        }
        figureCaption={frequencyLabel(expense)}
        loading={loading}
        details={
          // Mientras baja el chunk, el skeleton del panel, salvo que ya lo
          // pinte DetailSheet porque el historial también está cargando
          <Suspense fallback={loading ? null : <DetailSheetSkeleton />}>
            <RecurringExpenseSheetBody.Component
              expense={expense}
              categories={categories}
              accounts={accounts}
              currency={currency}
              month={month}
              loading={loading}
              history={history}
              error={error}
              nextUnpaid={nextUnpaid}
              pending={pending}
              onToggle={toggle}
              onPay={setPaying}
              onEdit={() => setEditing(true)}
              onDelete={() => setDeleting(true)}
              onReload={reload}
              onShowMore={showMore}
            />
          </Suspense>
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
