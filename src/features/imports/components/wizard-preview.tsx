"use client"

import { formatCurrency } from "@/libs/format"
import type { ResultingBalance } from "../balances"
import { countLabel } from "../targets"
import {
  debtEntryColumns,
  goalContributionColumns,
  recurringColumns,
  transactionColumns
} from "./preview-columns"
import { Balances, CreateTransactionsField } from "./preview-extras"
import { PreviewStep } from "./preview-step"
import type { PreviewState } from "./wizard-types"

interface WizardPreviewProps {
  preview: PreviewState
  currency: string
  categoryNames: Record<string, string>
  /** Solo con la columna Método mapeada */
  accountNames?: Record<string, string>
  linkNames: Record<string, string>
  balances: ResultingBalance[]
  /** Primer saldo que quedaría negativo: bloquea la importación */
  negative: ResultingBalance | null
  hasLinkedPayments: boolean
  createTransactions: boolean
  onCreateTransactionsChange: (checked: boolean) => void
  importing: boolean
  error: string | null
  onToggle: (index: number) => void
  onBack: () => void
  onConfirm: () => void
}

/** Paso 5 con las columnas y los bloques del destino */
export function WizardPreview({
  preview,
  currency,
  categoryNames,
  accountNames,
  linkNames,
  balances,
  negative,
  hasLinkedPayments,
  createTransactions,
  onCreateTransactionsChange,
  importing,
  error,
  onToggle,
  onBack,
  onConfirm
}: WizardPreviewProps) {
  const common = {
    empty: preview.empty,
    countLabel: (count: number) => countLabel(preview.target, count),
    importing,
    error,
    onToggle,
    onBack,
    onConfirm
  }
  const blocked = negative
    ? `El saldo de «${negative.name}» quedaría en ${formatCurrency(negative.result, currency)}`
    : null

  switch (preview.target) {
    case "transactions":
      return (
        <PreviewStep
          {...common}
          rows={preview.rows}
          columns={transactionColumns(currency, categoryNames, accountNames)}
        />
      )
    case "recurring_expenses":
      return (
        <PreviewStep
          {...common}
          rows={preview.rows}
          columns={recurringColumns(currency, categoryNames)}
        />
      )
    case "debt_entries":
      return (
        <PreviewStep
          {...common}
          rows={preview.rows}
          columns={debtEntryColumns(currency, linkNames)}
          blocked={blocked}
          extra={
            <>
              <Balances
                title="Saldos de tus deudas"
                balances={balances}
                currency={currency}
              />
              {hasLinkedPayments && (
                <CreateTransactionsField
                  checked={createTransactions}
                  disabled={importing}
                  onChange={onCreateTransactionsChange}
                />
              )}
            </>
          }
        />
      )
    case "goal_contributions":
      return (
        <PreviewStep
          {...common}
          rows={preview.rows}
          columns={goalContributionColumns(currency, linkNames)}
          blocked={blocked}
          extra={
            <Balances
              title="Ahorrado en tus metas"
              balances={balances}
              currency={currency}
            />
          }
        />
      )
  }
}
