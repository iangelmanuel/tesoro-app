"use client"

import { Button } from "@heroui/react"
import { Check } from "lucide-react"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog"
import type { IncomeSourceOption, UpcomingIncome } from "../queries"

interface ReceiveIncomeButtonProps {
  workspaceId: string
  income: UpcomingIncome
  categories: Category[]
  accounts: PaymentAccountOption[]
  /** Ingresos fijos activos, para el select del tab Ingreso */
  incomeSources: IncomeSourceOption[]
}

// Abre TransactionDialog en Ingreso con el ingreso fijo, el monto esperado,
// la categoría y la cuenta por defecto prellenados (todo editable). Solo se
// muestra en la ocurrencia no recibida más antigua de cada ingreso fijo: es
// la que el servidor enlaza al guardar
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

  return (
    <TransactionDialog
      workspaceId={workspaceId}
      categories={categories}
      accounts={accounts}
      incomeSources={incomeSources}
      initialValues={{
        type: "income",
        amount: income.amount,
        category_id: income.category.id,
        account_id: accountId,
        occurred_on: income.dueOn,
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
          Marcar recibido
        </Button>
      }
    />
  )
}
