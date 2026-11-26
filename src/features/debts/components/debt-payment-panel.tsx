"use client"

import { useState } from "react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { type DebtOption, DebtSelect } from "./payment-dialog"
import { PaymentDialogForm } from "./payment-dialog-form"

interface DebtPaymentPanelProps {
  workspaceId: string
  /** Deudas activas para elegir (tarjetas y préstamos) */
  debts: DebtOption[]
  accounts: PaymentAccountOption[]
  onSaved: () => void
  onCancel: () => void
}

/**
 * Elegir deuda + formulario de pago, sin el diálogo: tab "Pago de deuda" del
 * diálogo de movimiento. Mismo resultado que PaymentDialog desde "Más"
 */
export function DebtPaymentPanel({
  workspaceId,
  debts,
  accounts,
  onSaved,
  onCancel
}: DebtPaymentPanelProps) {
  // Arranca con la primera de la lista
  const [selectedDebtId, setSelectedDebtId] = useState(() => debts[0]?.id ?? "")
  const debt = debts.find((option) => option.id === selectedDebtId)

  return (
    <div className="flex flex-col gap-4">
      <DebtSelect
        debts={debts}
        value={selectedDebtId}
        onChange={setSelectedDebtId}
      />
      {debt && (
        <PaymentDialogForm
          // Cambiar de deuda reinicia el formulario (tipo y textos)
          key={debt.id}
          workspaceId={workspaceId}
          debt={debt}
          accounts={accounts}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
