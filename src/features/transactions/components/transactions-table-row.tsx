"use client"

import { Banknote } from "lucide-react"
import { TableCell } from "@/components/ui/table"
import { AccountLabel } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import { deleteEntry } from "@/features/debts/actions"
import { DebtEntryDialog } from "@/features/debts/components/debt-entry-dialog"
import {
  DuplicateDebtEntryLoader,
  DuplicateReceivableLoader
} from "@/features/debts/components/duplicate-debt-entry-dialog"
import type { IncomeSourceOption } from "@/features/recurring-incomes/queries"
import type { WorkspaceType } from "@/features/workspaces/types"
import { cn } from "@/libs/cn"
import { formatCurrency } from "@/libs/format"
import { deleteTransaction } from "../actions"
import {
  type Reorder,
  type TransactionEntry,
  linkedPaymentNoun
} from "../ledger-rows"
import type { LinkedDebtEntry } from "../types"
import { DuplicateTransactionDialog } from "./duplicate-transaction-dialog"
import { TransactionDialog } from "./transaction-dialog"
import {
  CounterpartyCell,
  DateCell,
  DescriptionCell
} from "./transactions-table-cells"
import type { EntryConfig } from "./transactions-table-row-actions"
import { SortableRow } from "./transactions-table-sortable-row"

// Movimiento suelto (entrada o salida), o el de un pago enlazado a una deuda
export function TransactionRow({
  workspaceId,
  workspaceType,
  row,
  reorder,
  category,
  account,
  categories,
  accounts,
  currency,
  incomeSources
}: {
  workspaceId: string
  workspaceType: WorkspaceType
  row: TransactionEntry
  reorder: Reorder | undefined
  category: Category | undefined
  account: PaymentAccountOption | undefined
  categories: Category[]
  accounts: PaymentAccountOption[]
  currency: string
  incomeSources?: IncomeSourceOption[]
}) {
  const transaction = row.transaction
  const isIncome = transaction.type === "income"
  const entry: EntryConfig = row.debt_entry
    ? linkedPaymentEntry({
        label: transaction.description,
        entry: row.debt_entry,
        accounts,
        categories,
        currency
      })
    : {
        label: transaction.description,
        remove: {
          title: "¿Eliminar este movimiento?",
          success: "Movimiento eliminado",
          onDelete: () => deleteTransaction(workspaceId, transaction.id)
        },
        renderEdit: (dialog) => (
          <TransactionDialog
            workspaceId={workspaceId}
            workspaceType={workspaceType}
            categories={categories}
            accounts={accounts}
            transaction={transaction}
            incomeSources={incomeSources}
            open={dialog.open}
            onOpenChange={dialog.onOpenChange}
          />
        ),
        renderDuplicate: (dialog) =>
          dialog.open && (
            <DuplicateTransactionDialog
              workspaceId={workspaceId}
              workspaceType={workspaceType}
              transactionId={transaction.id}
              categories={categories}
              accounts={accounts}
              incomeSources={incomeSources}
              onOpenChange={dialog.onOpenChange}
            />
          )
      }

  return (
    <SortableRow
      reorder={reorder}
      entry={entry}
    >
      <DateCell
        date={transaction.occurred_on}
        time={row.occurred_time}
      />
      <DescriptionCell
        title={transaction.description}
        note={transaction.note}
        // Ingreso de un avance de tarjeta (SPEC 36)
        icon={row.debt_entry?.kind === "advance" ? Banknote : undefined}
      />
      <TableCell>
        {category && (
          <CategoryBadge
            name={category.name}
            icon={category.icon}
            color={category.color}
          />
        )}
      </TableCell>
      {workspaceType === "business" && (
        <CounterpartyCell
          counterparty={transaction.counterparty}
          invoiceRef={transaction.invoice_ref}
        />
      )}
      <TableCell>
        {account ? (
          <AccountLabel account={account} />
        ) : (
          <span className="text-muted-foreground">Sin cuenta</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-end font-medium tabular-nums",
          isIncome ? "text-(--income)" : "text-(--expense)"
        )}
      >
        {/* El signo se lee: "más" o "menos" antes del monto completo */}
        <span aria-hidden="true">{isIncome ? "+" : "−"}</span>
        <span className="sr-only">{isIncome ? "más " : "menos "}</span>
        {formatCurrency(transaction.amount, currency)}
      </TableCell>
    </SortableRow>
  )
}

// Movimiento de un pago de préstamo, un cobro de Me deben (SPEC 26) o un
// avance de tarjeta (SPEC 36). El abono es la fuente de verdad: se edita con
// su diálogo y el trigger copia monto, fecha y hora al movimiento; eliminarlo
// borra los dos juntos.
function linkedPaymentEntry({
  label,
  entry,
  accounts,
  categories,
  currency
}: {
  label: string
  entry: LinkedDebtEntry
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
}): EntryConfig {
  const noun = linkedPaymentNoun(entry)

  return {
    label,
    remove: {
      title: `¿Eliminar este ${noun}?`,
      success: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} eliminado`,
      onDelete: () => deleteEntry(entry.id)
    },
    renderEdit: (dialog) =>
      // El mismo editor que el Sheet de la deuda (SPEC 42)
      dialog.open && (
        <DebtEntryDialog
          workspaceId={entry.workspace_id}
          entryId={entry.id}
          accounts={accounts}
          categories={categories}
          currency={currency}
          open
          onOpenChange={dialog.onOpenChange}
        />
      ),
    renderDuplicate:
      // Solo con la deuda activa. El cobro de un Me deben mensual va por su
      // diálogo, a la cuota pendiente siguiente (toast si no queda)
      entry.debt_status === "active"
        ? (dialog) =>
            dialog.open &&
            (entry.debt_kind === "receivable" &&
            entry.debt_schedule === "monthly" ? (
              <DuplicateReceivableLoader
                workspaceId={entry.workspace_id}
                entryId={entry.id}
                accounts={accounts}
                onOpenChange={dialog.onOpenChange}
              />
            ) : (
              <DuplicateDebtEntryLoader
                workspaceId={entry.workspace_id}
                entryId={entry.id}
                accounts={accounts}
                onOpenChange={dialog.onOpenChange}
              />
            ))
        : undefined
  }
}
