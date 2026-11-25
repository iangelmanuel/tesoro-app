"use client"

import { useState } from "react"
import { FormDialog } from "@/components/forms/form-dialog"
import { SelectField } from "@/components/forms/select-field"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { CollectableReceivable } from "../receivable-collect"
import { ReceivableCollectFormFields } from "./receivable-collect-form-fields"
import { useReceivableSummary } from "./use-receivable-collect-form"

interface ReceivableCollectFormProps {
  workspaceId: string
  /** Cuentas por cobrar activas que se pueden elegir */
  receivables: CollectableReceivable[]
  /** Cuenta por cobrar elegida al abrir. Con `fixed`, no se puede cambiar */
  receivableId?: string
  /** Sheet de la cuenta por cobrar: sin selector */
  fixed?: boolean
  /** Cuota elegida al abrir (Una cuota) */
  periodOn?: string
  /** Cuentas con saldo para la cuenta que recibe */
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Cobro de una cuenta por cobrar (SPEC 39). Lo comparten el tab Me deben del
 * diálogo de movimiento y el Sheet de la cuenta por cobrar:
 * - cobro único: Abono | Pago completo;
 * - mensual: Una cuota | Varios meses (reparto desde la cuota más antigua).
 * Crea un solo abono y, si se marca, un solo ingreso.
 */
export function ReceivableCollectForm({
  workspaceId,
  receivables,
  receivableId,
  fixed = false,
  periodOn,
  accounts,
  onSaved,
  onCancel
}: ReceivableCollectFormProps) {
  const [selectedId, setSelectedId] = useState(
    () => receivableId ?? receivables[0]?.id ?? ""
  )
  const receivable = receivables.find((option) => option.id === selectedId)

  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <ReceivableSelect
          receivables={receivables}
          value={selectedId}
          onChange={setSelectedId}
        />
      )}
      {receivable && (
        <ReceivableCollectFormFields
          // Cambiar de cuenta por cobrar reinicia modo, cuota y monto
          key={receivable.id}
          workspaceId={workspaceId}
          receivable={receivable}
          periodOn={receivable.id === receivableId ? periodOn : undefined}
          accounts={accounts}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

interface ReceivableCollectDialogProps {
  workspaceId: string
  receivable: CollectableReceivable
  /** Cuota elegida al abrir (Una cuota) */
  periodOn?: string
  accounts: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Cobro desde el Sheet de una cuenta por cobrar: el mismo formulario del tab */
export function ReceivableCollectDialog({
  workspaceId,
  receivable,
  periodOn,
  accounts,
  trigger,
  open: controlledOpen,
  onOpenChange
}: ReceivableCollectDialogProps) {
  return (
    <FormDialog
      trigger={trigger}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-md"
      title="Registrar cobro"
      description={`Lo que te pagaron de ${receivable.name}.`}
    >
      {(close) => (
        <ReceivableCollectForm
          workspaceId={workspaceId}
          receivables={[receivable]}
          receivableId={receivable.id}
          fixed
          periodOn={periodOn}
          accounts={accounts}
          onSaved={close}
          onCancel={close}
        />
      )}
    </FormDialog>
  )
}

function ReceivableSelect({
  receivables,
  value,
  onChange
}: {
  receivables: CollectableReceivable[]
  value: string
  onChange: (value: string) => void
}) {
  const summary = useReceivableSummary()

  return (
    <SelectField
      label="Cuenta por cobrar"
      help="receivable.select"
      value={value}
      onChange={onChange}
      options={receivables.map((option) => ({
        value: option.id,
        label: option.name,
        description: summary(option)
      }))}
    />
  )
}
