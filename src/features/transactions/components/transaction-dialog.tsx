"use client"

import { Suspense } from "react"
import {
  FormDialog,
  FormDialogBodySkeleton
} from "@/components/forms/form-dialog"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { transactionDialogText } from "../transaction-form-values"
import type {
  EditableTransaction,
  FormPanel,
  RecurringOccurrenceLink,
  TransactionInitialValues
} from "../types"
import type { PaymentTabsData } from "./transaction-form-panels"

// El formulario (campos, calendario, tabs de pago) se descarga al abrir el
// diálogo o al pasar por su disparador (SPEC 56b). El título ya es el real
const TransactionForm = lazyWithPreload(() =>
  import("./transaction-form").then((m) => m.TransactionForm)
)

/** Precarga el formulario de movimiento: `onPointerEnter` / `onFocus` */
export const preloadTransactionForm = TransactionForm.preload

interface TransactionDialogProps {
  /** Espacio donde se crea o edita el movimiento */
  workspaceId: string
  /** En Empresa cambian los textos y aparecen cliente/proveedor y factura */
  workspaceType?: WorkspaceType
  /** Categorías del sistema y propias, activas y archivadas */
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: PaymentAccountOption[]
  /** Si llega, el diálogo edita este movimiento */
  transaction?: EditableTransaction
  /** Prellenado de un movimiento nuevo */
  initialValues?: TransactionInitialValues
  /** Si llega, el movimiento nuevo es el pago de esta ocurrencia */
  recurring?: RecurringOccurrenceLink
  /**
   * Tabs "Deuda" (pagos y avances) y "Gasto fijo" (solo Personal y al
   * registrar):
   * deudas activas y ocurrencias sin pagar. Los pasa el botón del header
   */
  paymentTabs?: PaymentTabsData
  /**
   * Ingresos fijos activos para el select "Ingreso fijo" del tab Ingreso
   * (solo Personal). Sin ellos no hay select y, al editar, el enlace se
   * conserva
   */
  incomeSources?: IncomeSourceOption[]
  /**
   * Tab de pago con el que abre (p. ej. "receivable" desde "Cobro de Me
   * deben" del menú Más). Solo aplica con `paymentTabs`
   */
  initialPanel?: FormPanel
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TransactionDialog({
  workspaceId,
  workspaceType = "personal",
  categories,
  accounts,
  transaction,
  initialValues,
  recurring,
  paymentTabs,
  incomeSources,
  initialPanel,
  trigger,
  open: controlledOpen,
  onOpenChange
}: TransactionDialogProps) {
  const isEditing = transaction !== undefined
  const isPayment = !isEditing && recurring !== undefined
  // Empresa no tiene deudas ni gastos fijos; al editar o pagar una
  // ocurrencia concreta tampoco aplican
  const showPaymentTabs =
    paymentTabs !== undefined &&
    workspaceType === "personal" &&
    !isEditing &&
    !isPayment
  const { title, description } = transactionDialogText(
    { isEditing, isPayment },
    workspaceType
  )

  return (
    <FormDialog
      trigger={trigger}
      onTriggerIntent={TransactionForm.preload}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      // Con 7 tabs el diálogo se ensancha para que quepan en escritorio
      className={showPaymentTabs ? "sm:max-w-xl" : undefined}
      title={title}
      description={description}
    >
      {(close) => (
        <Suspense
          fallback={
            <FormDialogBodySkeleton
              tabs={!isEditing}
              fields={5}
            />
          }
        >
          <TransactionForm.Component
            workspaceId={workspaceId}
            workspaceType={workspaceType}
            categories={categories}
            accounts={accounts}
            transaction={transaction}
            initialValues={isEditing ? undefined : initialValues}
            recurring={isEditing ? undefined : recurring}
            paymentTabs={showPaymentTabs ? paymentTabs : undefined}
            // El traspaso existe en ambos espacios (atajo T, SPEC 51)
            initialPanel={
              showPaymentTabs || initialPanel === "transfer"
                ? initialPanel
                : undefined
            }
            incomeSources={
              workspaceType === "personal" && !isPayment
                ? (incomeSources ?? paymentTabs?.incomeSources)
                : undefined
            }
            onSaved={close}
            onCancel={close}
          />
        </Suspense>
      )}
    </FormDialog>
  )
}
