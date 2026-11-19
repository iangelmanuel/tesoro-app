"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { toast } from "@heroui/react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { loadTransactionDuplicate } from "../actions"
import {
  type RecurringOccurrenceLink,
  TransactionDialog,
  type TransactionInitialValues
} from "./transaction-dialog"

interface DuplicateTransactionDialogProps {
  workspaceId: string
  workspaceType?: WorkspaceType
  /** Movimiento que se duplica */
  transactionId: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources?: IncomeSourceOption[]
  /** Se monta al elegir Duplicar; al cerrar se desmonta */
  onOpenChange: (open: boolean) => void
}

interface Duplicate {
  initialValues: TransactionInitialValues
  recurring?: RecurringOccurrenceLink
}

/**
 * Duplicar un movimiento suelto o un pago de fijo (SPEC 49). Pide al
 * servidor los valores del duplicado (y el periodo destino) y abre el
 * diálogo de crear prellenado. Si no se puede duplicar, muestra un toast y no
 * abre nada.
 */
export function DuplicateTransactionDialog({
  workspaceId,
  workspaceType,
  transactionId,
  categories,
  accounts,
  incomeSources,
  onOpenChange
}: DuplicateTransactionDialogProps) {
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  // Sin periodo pendiente u otro error: toast y se cierra sin abrir nada
  const onLoadError = useEffectEvent((message: string) => {
    toast.danger(message)
    onOpenChange(false)
  })

  useEffect(() => {
    let active = true
    loadTransactionDuplicate(workspaceId, transactionId).then((result) => {
      if (!active) return
      if ("error" in result) {
        onLoadError(result.error)
      } else {
        setDuplicate(result)
      }
    })
    return () => {
      active = false
    }
  }, [workspaceId, transactionId])

  if (!duplicate) return null

  return (
    <TransactionDialog
      workspaceId={workspaceId}
      workspaceType={workspaceType}
      categories={categories}
      accounts={accounts}
      incomeSources={incomeSources}
      initialValues={duplicate.initialValues}
      recurring={duplicate.recurring}
      open
      onOpenChange={onOpenChange}
    />
  )
}
