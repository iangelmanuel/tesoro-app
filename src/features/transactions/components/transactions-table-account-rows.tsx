"use client"

import { ArrowLeftRight, RefreshCw } from "lucide-react"
import { TableCell } from "@/components/ui/table"
import { activeAccountId } from "@/features/accounts/active-account"
import { deleteAdjustment } from "@/features/accounts/adjustment-actions"
import { AccountLabel } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { deleteTransfer } from "@/features/accounts/transfer-actions"
import type { Category } from "@/features/categories/queries"
import { DebtEntryDialog } from "@/features/debts/components/debt-entry-dialog"
import { DuplicateDebtEntryLoader } from "@/features/debts/components/duplicate-debt-entry-dialog"
import { deleteEntry } from "@/features/debts/entry-actions"
import { deleteContribution } from "@/features/goals/actions"
import { ContributionDialog } from "@/features/goals/components/contribution-dialog"
import {
  type AccountMovementEntry,
  type AdjustmentEntry,
  type Reorder,
  type TransferEntry,
  accountMovementDeletedText,
  describeAccountMovement
} from "../ledger-rows"
import {
  DateCell,
  DescriptionCell,
  NeutralAmountCell
} from "./transactions-table-cells"
import type { EntryConfig } from "./transactions-table-row-actions"
import { SortableRow } from "./transactions-table-sortable-row"

// Filas neutras de la tabla de Movimientos: no suman a los totales

// Traspaso: neutro, sin signo y sin categoría. No suma a los totales.
export function TransferRow({
  workspaceId,
  showCounterparty,
  transfer,
  label,
  accounts,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  transfer: TransferEntry
  label: string
  accounts: PaymentAccountOption[]
  currency: string
  reorder: Reorder | undefined
}) {
  const entry: EntryConfig = {
    label: `Traspaso ${label}`,
    remove: {
      title: "¿Eliminar este traspaso?",
      success: "Traspaso eliminado",
      onDelete: () => deleteTransfer(workspaceId, transfer.id)
    },
    renderEdit: (dialog) => (
      <TransferDialog
        workspaceId={workspaceId}
        accounts={accounts}
        transfer={transfer}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
      />
    ),
    renderDuplicate: (dialog) =>
      dialog.open && (
        <TransferDialog
          workspaceId={workspaceId}
          accounts={accounts}
          // Mismas cuentas (si siguen activas), monto y nota; fecha de
          // hoy y hora vacía (SPEC 49)
          initialValues={{
            from_account_id: activeAccountId(
              accounts,
              transfer.from_account_id
            ),
            to_account_id: activeAccountId(accounts, transfer.to_account_id),
            amount: transfer.amount,
            note: transfer.note ?? ""
          }}
          open
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
        date={transfer.occurred_on}
        time={transfer.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={transfer.note}
        icon={ArrowLeftRight}
      />
      <TableCell className="text-muted-foreground">Traspaso</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell />
      <NeutralAmountCell
        sign={null}
        amount={transfer.amount}
        currency={currency}
      />
    </SortableRow>
  )
}

// Pago de tarjeta, avance o aporte con cuenta: gris, con signo según el saldo
// de la cuenta. No suma a los totales. Se edita y elimina con el diálogo y
// las actions de la deuda o la meta (SPEC 26), que recalculan su saldo. Un
// avance con cuenta ya es un ingreso (SPEC 36): aquí solo llegan los antiguos
// que la migración no pudo convertir.
export function AccountMovementRow({
  workspaceId,
  showCounterparty,
  entry,
  account,
  accounts,
  categories,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  entry: AccountMovementEntry
  account: PaymentAccountOption | undefined
  /** Cuentas y categorías del editor del movimiento de la deuda (SPEC 42) */
  accounts: PaymentAccountOption[]
  categories: Category[]
  currency: string
  reorder: Reorder | undefined
}) {
  const { title, type, icon, increases } = describeAccountMovement(entry)

  const config: EntryConfig =
    entry.kind === "goal_contribution"
      ? {
          label: title,
          remove: {
            title: `¿Eliminar este ${type.toLowerCase()}?`,
            success: accountMovementDeletedText(entry),
            onDelete: () => deleteContribution(entry.id)
          },
          renderEdit: (dialog) => (
            <ContributionDialog
              workspaceId={workspaceId}
              goalId={entry.parent_id}
              contribution={{
                id: entry.id,
                amount: entry.amount,
                occurred_on: entry.occurred_on,
                occurred_time: entry.occurred_time,
                note: entry.note
              }}
              open={dialog.open}
              onOpenChange={dialog.onOpenChange}
            />
          ),
          renderDuplicate:
            // Solo con la meta activa: cumplida o archivada no recibe aportes
            entry.parent_active
              ? (dialog) =>
                  dialog.open && (
                    <ContributionDialog
                      workspaceId={workspaceId}
                      goalId={entry.parent_id}
                      kind={entry.amount < 0 ? "withdrawal" : "deposit"}
                      accounts={accounts}
                      initialValues={{
                        amount: Math.abs(entry.amount),
                        account_id: activeAccountId(accounts, entry.account_id),
                        note: entry.note ?? ""
                      }}
                      open
                      onOpenChange={dialog.onOpenChange}
                    />
                  )
              : undefined
        }
      : {
          label: title,
          remove: {
            title: `¿Eliminar este ${type.toLowerCase()}?`,
            success: accountMovementDeletedText(entry),
            onDelete: () => deleteEntry(entry.id)
          },
          renderEdit: (dialog) =>
            // El mismo editor que el Sheet de la deuda (SPEC 42)
            dialog.open && (
              <DebtEntryDialog
                workspaceId={workspaceId}
                entryId={entry.id}
                accounts={accounts}
                categories={categories}
                currency={currency}
                open
                onOpenChange={dialog.onOpenChange}
              />
            ),
          renderDuplicate:
            // Pago o avance antiguo de tarjeta: solo con la deuda activa
            entry.parent_active
              ? (dialog) =>
                  dialog.open && (
                    <DuplicateDebtEntryLoader
                      workspaceId={workspaceId}
                      entryId={entry.id}
                      accounts={accounts}
                      onOpenChange={dialog.onOpenChange}
                    />
                  )
              : undefined
        }

  return (
    <SortableRow
      reorder={reorder}
      entry={config}
    >
      <DateCell
        date={entry.occurred_on}
        time={entry.occurred_time}
      />
      <DescriptionCell
        title={title}
        note={entry.note}
        icon={icon}
      />
      <TableCell className="text-muted-foreground">{type}</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell>{account && <AccountLabel account={account} />}</TableCell>
      <NeutralAmountCell
        sign={increases ? "+" : "−"}
        amount={Math.abs(entry.amount)}
        currency={currency}
      />
    </SortableRow>
  )
}

// Ajuste de saldo: neutro, con signo. Solo se elimina.
export function AdjustmentRow({
  workspaceId,
  showCounterparty,
  adjustment,
  label,
  currency,
  reorder
}: {
  workspaceId: string
  showCounterparty: boolean
  adjustment: AdjustmentEntry
  label: string
  currency: string
  reorder: Reorder | undefined
}) {
  const entry: EntryConfig = {
    label,
    remove: {
      title: "¿Eliminar este ajuste?",
      success: "Ajuste eliminado",
      onDelete: () => deleteAdjustment(workspaceId, adjustment.id)
    }
  }

  return (
    <SortableRow
      reorder={reorder}
      entry={entry}
    >
      <DateCell
        date={adjustment.occurred_on}
        time={adjustment.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={adjustment.note}
        icon={RefreshCw}
      />
      <TableCell className="text-muted-foreground">Ajuste</TableCell>
      {showCounterparty && <TableCell />}
      <TableCell />
      <NeutralAmountCell
        sign={adjustment.amount > 0 ? "+" : "−"}
        amount={Math.abs(adjustment.amount)}
        currency={currency}
      />
    </SortableRow>
  )
}
