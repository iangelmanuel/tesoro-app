"use client"

import { Suspense, useState } from "react"
import {
  FormDialog,
  FormDialogBodySkeleton
} from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import type { DebtPaymentDescriptions } from "../payment-description"
import type { PaymentDebt, PaymentInitialValues } from "../payment-form-values"
import type { Debt } from "../queries"

// Tipo, monto, fecha y cuenta se descargan al abrir el diálogo o al pasar
// por su disparador (SPEC 56b)
const PaymentDialogForm = lazyWithPreload(() =>
  import("./payment-dialog-form").then((m) => m.PaymentDialogForm)
)

/** Precarga el formulario de pago de deuda: `onPointerEnter` / `onFocus` */
export const preloadPaymentForm = PaymentDialogForm.preload

/** Deuda que se puede elegir en el diálogo (acceso rápido del header) */
export type DebtOption = Pick<Debt, "id" | "kind" | "name" | "account_id"> & {
  descriptions: DebtPaymentDescriptions
}

interface PaymentDialogProps {
  /** Espacio de la deuda (para crear una cuenta desde el select) */
  workspaceId: string
  /** Deuda fija. Sin ella, el diálogo deja elegir entre `debts` */
  debt?: PaymentDebt
  /** Deudas activas para elegir; se usa cuando no llega `debt` */
  debts?: DebtOption[]
  /** Cuentas con saldo para la cuenta del pago */
  accounts?: PaymentAccountOption[]
  /** Prellenado del movimiento nuevo; solo con `debt` fija */
  initialValues?: PaymentInitialValues
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Registrar un pago o abono de tarjeta o préstamo, o una compra o avance de
 * tarjeta. El cobro de una cuenta por cobrar va por ReceivableCollectForm
 * (SPEC 39) y editar cualquier movimiento de una deuda, por
 * DebtEntryDialog (SPEC 42)
 */
export function PaymentDialog({
  workspaceId,
  debt: fixedDebt,
  debts,
  accounts = [],
  initialValues,
  trigger,
  open: controlledOpen,
  onOpenChange
}: PaymentDialogProps) {
  // Sin deuda fija arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(
    () => debts?.[0]?.id ?? ""
  )
  const debt: PaymentDebt | undefined =
    fixedDebt ?? debts?.find((option) => option.id === selectedDebtId)
  const kind = debt?.kind ?? "loan"

  return (
    <FormDialog
      trigger={trigger}
      onTriggerIntent={PaymentDialogForm.preload}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title={kind === "receivable" ? "Registrar abono" : "Registrar movimiento"}
      description={
        kind === "receivable"
          ? "Lo que te pagaron de esta cuenta por cobrar."
          : "Un pago, abono, compra, cargo o ajuste de esta deuda."
      }
    >
      {(close) => (
        <div className="flex flex-col gap-4">
          {!fixedDebt && debts && (
            <DebtSelect
              debts={debts}
              value={selectedDebtId}
              onChange={setSelectedDebtId}
            />
          )}
          {debt && (
            <Suspense
              fallback={
                <FormDialogBodySkeleton
                  fields={4}
                  tabs
                />
              }
            >
              <PaymentDialogForm.Component
                // Cambiar de deuda reinicia el formulario (tipo y textos)
                key={debt.id}
                workspaceId={workspaceId}
                debt={debt}
                accounts={accounts}
                initialValues={fixedDebt ? initialValues : undefined}
                onSaved={close}
                onCancel={close}
              />
            </Suspense>
          )}
        </div>
      )}
    </FormDialog>
  )
}

/** Elegir la deuda: el diálogo y el tab "Deuda" del diálogo de movimiento */
export function DebtSelect({
  debts,
  value,
  onChange
}: {
  debts: DebtOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <SelectField
      label="Deuda"
      help="debtEntry.debt"
      value={value}
      onChange={onChange}
      options={debts.map((option) => ({
        value: option.id,
        label: option.name
      }))}
    />
  )
}
