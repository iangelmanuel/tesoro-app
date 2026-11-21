"use client"

import { useState, useTransition } from "react"
import { Copy, Pencil, Trash2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { RowActions } from "@/components/dashboard/row-actions"
import { toast } from "@/components/ui/sonner"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import { deleteTransaction, loadEditableTransaction } from "../actions"
import type { EditableTransaction } from "../queries"
import { DuplicateTransactionDialog } from "./duplicate-transaction-dialog"
import { TransactionDialog } from "./transaction-dialog"

interface RecordedPaymentActionsProps {
  workspaceId: string
  /** Movimiento del pago o cobro */
  transactionId: string
  /** "pago" o "cobro": nombre de la fila y de los avisos */
  noun: "pago" | "cobro"
  /** Qué pasa con el periodo al eliminar ("octubre vuelve a pendiente") */
  deleteEffect: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources?: IncomeSourceOption[]
  /**
   * Muestra Duplicar (SPEC 49). El Sheet lo apaga cuando sabe que no quedan
   * periodos pendientes
   */
  canDuplicate?: boolean
  /** Tras editar, duplicar o eliminar: vuelve a pedir el historial */
  onChanged: () => void
}

/**
 * Editar, Duplicar y Eliminar un pago o cobro ya registrado desde el Sheet de
 * su gasto o ingreso fijo (SPEC 42 y 49). Es el mismo movimiento que en
 * Movimientos: se edita con TransactionDialog, se duplica con
 * DuplicateTransactionDialog y se borra con deleteTransaction.
 */
export function RecordedPaymentActions({
  workspaceId,
  transactionId,
  noun,
  deleteEffect,
  categories,
  accounts,
  incomeSources,
  canDuplicate = false,
  onChanged
}: RecordedPaymentActionsProps) {
  const [transaction, setTransaction] = useState<EditableTransaction | null>(
    null
  )
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()

  function edit() {
    startTransition(async () => {
      const result = await loadEditableTransaction(workspaceId, transactionId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        setTransaction(result.transaction)
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTransaction(workspaceId, transactionId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(noun === "pago" ? "Pago eliminado" : "Cobro eliminado")
        onChanged()
      }
    })
  }

  return (
    <>
      <RowActions
        label={noun}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: <Pencil className="size-4" />,
            disabled: pending,
            onAction: edit
          },
          ...(canDuplicate
            ? [
                {
                  id: "duplicate",
                  label: "Duplicar",
                  icon: <Copy className="size-4" />,
                  disabled: pending,
                  onAction: () => setDuplicating(true)
                }
              ]
            : []),
          {
            id: "delete",
            label: "Eliminar",
            icon: <Trash2 className="size-4" />,
            destructive: true,
            disabled: pending,
            onAction: () => setDeleting(true)
          }
        ]}
      />
      {transaction && (
        <TransactionDialog
          workspaceId={workspaceId}
          categories={categories}
          accounts={accounts}
          incomeSources={incomeSources}
          transaction={transaction}
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setTransaction(null)
              onChanged()
            }
          }}
        />
      )}
      {duplicating && (
        <DuplicateTransactionDialog
          workspaceId={workspaceId}
          transactionId={transactionId}
          categories={categories}
          accounts={accounts}
          incomeSources={incomeSources}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setDuplicating(false)
              onChanged()
            }
          }}
        />
      )}
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`¿Eliminar este ${noun}?`}
        onConfirm={remove}
      >
        <p className="text-sm text-muted-foreground">
          También se elimina de Movimientos y {deleteEffect}. Esta acción no se
          puede deshacer.
        </p>
      </DeleteDialog>
    </>
  )
}
