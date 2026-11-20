"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import type { IncomeSourceOption } from "../queries"
import { amountDueUntil, incomeReceiptDescription } from "../receipt"

/** Lo que **Recibir** necesita de la ocurrencia y su ingreso fijo */
export interface ReceiveTarget {
  recurringIncomeId: string
  name: string
  /** Monto esperado: se usa si no falta nada hasta la fila */
  amount: number
  categoryId: string
  /** Cuenta por defecto del ingreso fijo */
  accountId: string | null
  /** Ocurrencia hasta la que se prellena lo que falta */
  dueOn: string
}

/**
 * Valores iniciales del tab Ingreso para recibir hasta `target.dueOn`: la
 * fuente, su categoría y su cuenta por defecto (si sigue activa), y lo que
 * falta de todas las ocurrencias abiertas hasta esa fila. El servidor reparte
 * desde la más antigua; la vista previa bajo el monto lo anticipa. Sin
 * fecha: el diálogo toma la de hoy (SPEC 41).
 */
export function receiveIncomeInitialValues(
  target: ReceiveTarget,
  accounts: PaymentAccountOption[],
  incomeSources: IncomeSourceOption[]
) {
  const accountId = accounts.some(
    (account) => account.id === target.accountId && !account.archived_at
  )
    ? target.accountId
    : null
  const source = incomeSources.find(
    (option) => option.id === target.recurringIncomeId
  )
  const dueUntilRow = source ? amountDueUntil(source, target.dueOn) : 0

  return {
    type: "income" as const,
    amount: dueUntilRow > 0 ? dueUntilRow : target.amount,
    category_id: target.categoryId,
    account_id: accountId,
    // "Ingreso {nombre} · {periodo}" de lo que cubre (SPEC 41)
    description: source
      ? incomeReceiptDescription(source, target.dueOn)
      : target.name,
    recurring_income_id: target.recurringIncomeId
  }
}

interface ReceiveIncomeButtonProps {
  workspaceId: string
  target: ReceiveTarget
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Ingresos fijos activos, para el select del tab Ingreso */
  incomeSources: IncomeSourceOption[]
}

// **Recibir** (SPEC 38): se muestra en toda ocurrencia no recibida o
// abonada. Abre TransactionDialog en Ingreso prellenado (todo editable)
export function ReceiveIncomeButton({
  workspaceId,
  target,
  categories,
  accounts,
  incomeSources
}: ReceiveIncomeButtonProps) {
  return (
    <TransactionDialog
      workspaceId={workspaceId}
      categories={categories}
      accounts={accounts}
      incomeSources={incomeSources}
      initialValues={receiveIncomeInitialValues(
        target,
        accounts,
        incomeSources
      )}
      trigger={
        <Button
          data-tour="income-receive"
          size="sm"
          variant="outline"
          className="max-md:min-h-11 max-md:w-full"
        >
          <Check />
          Recibir
        </Button>
      }
    />
  )
}
