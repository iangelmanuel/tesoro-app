"use client"

import { Button } from "@heroui/react"
import { Check } from "lucide-react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import type { IncomeSourceOption, UpcomingIncome } from "../queries"
import { amountDueUntil } from "../receipt"

interface ReceiveIncomeButtonProps {
  workspaceId: string
  income: UpcomingIncome
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Ingresos fijos activos, para el select del tab Ingreso */
  incomeSources: IncomeSourceOption[]
}

// Abre TransactionDialog en Ingreso con el ingreso fijo, la categoría y la
// cuenta por defecto prellenados (todo editable). Se muestra en toda
// ocurrencia no recibida o abonada (SPEC 38). El monto es lo que falta de
// todas las ocurrencias abiertas hasta la de la fila: el servidor lo reparte
// desde la más antigua, y la vista previa bajo el monto lo anticipa
export function ReceiveIncomeButton({
  workspaceId,
  income,
  categories,
  accounts,
  incomeSources
}: ReceiveIncomeButtonProps) {
  // La cuenta por defecto solo se prellena si sigue activa
  const accountId = accounts.some(
    (account) => account.id === income.accountId && !account.archived_at
  )
    ? income.accountId
    : null
  const source = incomeSources.find(
    (option) => option.id === income.recurringIncomeId
  )
  const dueUntilRow = source ? amountDueUntil(source, income.dueOn) : 0
  const amount = dueUntilRow > 0 ? dueUntilRow : income.amount

  return (
    <TransactionDialog
      workspaceId={workspaceId}
      categories={categories}
      accounts={accounts}
      incomeSources={incomeSources}
      initialValues={{
        type: "income",
        amount,
        category_id: income.category.id,
        account_id: accountId,
        description: income.name,
        recurring_income_id: income.recurringIncomeId
      }}
      trigger={
        // key: el Modal de HeroUI recorre sus hijos como lista y, con el
        // botón creado en otro componente, React avisa de la falta de key
        <Button
          key="receive-income"
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
