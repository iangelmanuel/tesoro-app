"use client"

import { useState } from "react"
import { Button, Modal } from "@heroui/react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import type { UpcomingPayment } from "../queries"
import {
  OccurrenceSelect,
  paymentKey,
  selectedPayment
} from "./occurrence-select"

interface PayOccurrenceDialogProps {
  workspaceId: string
  /** Ocurrencias sin pagar, vencidas primero */
  payments: UpcomingPayment[]
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Botón que abre el diálogo. Sin él, se controla con open/onOpenChange */
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Elige una ocurrencia pendiente y abre TransactionDialog prellenado y
// enlazado a ella, igual que PayOccurrenceButton
export function PayOccurrenceDialog({
  workspaceId,
  payments,
  categories,
  accounts,
  trigger,
  open: controlledOpen,
  onOpenChange
}: PayOccurrenceDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [selectedKey, setSelectedKey] = useState("")
  const [transactionOpen, setTransactionOpen] = useState(false)

  const selected = selectedPayment(payments, selectedKey)

  function onContinue() {
    setOpen(false)
    setTransactionOpen(true)
  }

  return (
    <>
      <Modal
        isOpen={open}
        onOpenChange={setOpen}
      >
        {trigger}
        <Modal.Backdrop>
          <Modal.Container scroll="outside">
            <Modal.Dialog className="sm:max-w-md">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Marcar gasto fijo pagado</Modal.Heading>
                <p className="text-sm text-muted">
                  Elige el pago. En el siguiente paso confirmas el monto.
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-4">
                  <OccurrenceSelect
                    payments={payments}
                    selected={selected}
                    onChange={setSelectedKey}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onPress={() => setOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onPress={onContinue}
                      isDisabled={!selected}
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {selected && (
        <TransactionDialog
          // Cada ocurrencia monta el formulario con sus propios valores
          key={paymentKey(selected)}
          workspaceId={workspaceId}
          categories={categories}
          accounts={accounts}
          initialValues={{
            amount: selected.amount,
            category_id: selected.category.id,
            occurred_on: selected.dueOn,
            description: selected.name
          }}
          recurring={{
            recurringExpenseId: selected.recurringExpenseId,
            dueOn: selected.dueOn
          }}
          open={transactionOpen}
          onOpenChange={setTransactionOpen}
        />
      )}
    </>
  )
}
