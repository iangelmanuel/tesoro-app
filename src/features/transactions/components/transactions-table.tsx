"use client"

import { useTransition } from "react"
import { AlertDialog, Button, Table, cn, toast } from "@heroui/react"
import { ArrowLeftRight, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { deleteAdjustment, deleteTransfer } from "@/features/accounts/actions"
import {
  AccountLabel,
  type AccountOption
} from "@/features/accounts/components/account-select"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteTransaction } from "../actions"
import type { EditableTransaction, LedgerEntry } from "../queries"
import { TransactionDialog } from "./transaction-dialog"

interface TransactionsTableProps {
  workspaceId: string
  /** En Empresa se muestran cliente/proveedor y factura */
  workspaceType?: WorkspaceType
  rows: LedgerEntry[]
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: AccountOption[]
  currency: string
}

type TransferEntry = Extract<LedgerEntry, { kind: "transfer" }>
type AdjustmentEntry = Extract<LedgerEntry, { kind: "adjustment" }>

// Client: cada fila abre el diálogo de edición, y así las categorías y las
// cuentas viajan una sola vez en vez de una por fila
export function TransactionsTable({
  workspaceId,
  workspaceType = "personal",
  rows,
  categories,
  accounts,
  currency
}: TransactionsTableProps) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const accountName = (id: string) => accountsById.get(id)?.name ?? "Cuenta"
  const isBusiness = workspaceType === "business"

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Movimientos"
          className="min-w-3xl"
        >
          <Table.Header>
            <Table.Column className="w-32">Fecha</Table.Column>
            <Table.Column isRowHeader>Descripción</Table.Column>
            <Table.Column>Categoría</Table.Column>
            {isBusiness ? (
              <Table.Column>Cliente o proveedor</Table.Column>
            ) : null}
            <Table.Column>Cuenta</Table.Column>
            <Table.Column className="text-end">Monto</Table.Column>
            <Table.Column className="w-24">
              <span className="sr-only">Acciones</span>
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => {
              if (row.kind === "transfer") {
                return (
                  <TransferRow
                    key={row.id}
                    workspaceId={workspaceId}
                    showCounterparty={isBusiness}
                    transfer={row}
                    label={`${accountName(row.from_account_id)} → ${accountName(row.to_account_id)}`}
                    accounts={accounts}
                    currency={currency}
                  />
                )
              }
              if (row.kind === "adjustment") {
                return (
                  <AdjustmentRow
                    key={row.id}
                    workspaceId={workspaceId}
                    showCounterparty={isBusiness}
                    adjustment={row}
                    label={`Ajuste de saldo · ${accountName(row.account_id)}`}
                    currency={currency}
                  />
                )
              }

              const transaction = row.transaction
              const category = categoriesById.get(transaction.category_id)
              const account = transaction.account_id
                ? accountsById.get(transaction.account_id)
                : undefined

              return (
                <Table.Row key={transaction.id}>
                  <Table.Cell className="text-muted">
                    {formatDate(transaction.occurred_on)}
                  </Table.Cell>
                  <DescriptionCell
                    title={transaction.description}
                    note={transaction.note}
                  />
                  <Table.Cell>
                    {category && (
                      <CategoryBadge
                        name={category.name}
                        icon={category.icon}
                        color={category.color}
                      />
                    )}
                  </Table.Cell>
                  {isBusiness && (
                    <CounterpartyCell
                      counterparty={transaction.counterparty}
                      invoiceRef={transaction.invoice_ref}
                    />
                  )}
                  <Table.Cell>
                    {account ? (
                      <AccountLabel account={account} />
                    ) : (
                      <span className="text-muted">Sin cuenta</span>
                    )}
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      "text-end font-medium tabular-nums",
                      transaction.type === "income"
                        ? "text-(--income)"
                        : "text-(--expense)"
                    )}
                  >
                    {transaction.type === "income" ? "+" : "−"}
                    {formatCurrency(transaction.amount, currency)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end gap-1">
                      <TransactionDialog
                        workspaceId={workspaceId}
                        workspaceType={workspaceType}
                        categories={categories}
                        accounts={accounts}
                        transaction={transaction}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={`Editar ${transaction.description}`}
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeleteTransactionButton
                        workspaceId={workspaceId}
                        transaction={transaction}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  )
}

// Cliente o proveedor y, debajo, el número de factura
function CounterpartyCell({
  counterparty,
  invoiceRef
}: {
  counterparty: string | null
  invoiceRef: string | null
}) {
  if (!counterparty && !invoiceRef) {
    return (
      <Table.Cell>
        <span className="text-muted">—</span>
      </Table.Cell>
    )
  }
  return (
    <Table.Cell className="max-w-48">
      {counterparty && <p className="truncate">{counterparty}</p>}
      {invoiceRef && (
        <p className="truncate text-sm text-muted">{invoiceRef}</p>
      )}
    </Table.Cell>
  )
}

function DescriptionCell({
  title,
  note,
  icon: Icon
}: {
  title: string
  note: string | null
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Table.Cell className="max-w-64">
      <p className="flex items-center gap-2 truncate font-medium">
        {Icon && <Icon className="size-4 shrink-0 text-muted" />}
        <span className="truncate">{title}</span>
      </p>
      {note && <p className="truncate text-xs text-muted">{note}</p>}
    </Table.Cell>
  )
}

// Traspaso: neutro, sin signo y sin categoría. No suma a los totales.
function TransferRow({
  workspaceId,
  showCounterparty,
  transfer,
  label,
  accounts,
  currency
}: {
  workspaceId: string
  showCounterparty: boolean
  transfer: TransferEntry
  label: string
  accounts: AccountOption[]
  currency: string
}) {
  return (
    <Table.Row>
      <Table.Cell className="text-muted">
        {formatDate(transfer.occurred_on)}
      </Table.Cell>
      <DescriptionCell
        title={label}
        note={transfer.note}
        icon={ArrowLeftRight}
      />
      <Table.Cell className="text-muted">Traspaso</Table.Cell>
      {showCounterparty && <Table.Cell />}
      <Table.Cell />
      <Table.Cell className="text-end font-medium text-muted tabular-nums">
        {formatCurrency(transfer.amount, currency)}
      </Table.Cell>
      <Table.Cell>
        <div className="flex justify-end gap-1">
          <TransferDialog
            workspaceId={workspaceId}
            accounts={accounts}
            transfer={transfer}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                aria-label={`Editar traspaso ${label}`}
              >
                <Pencil />
              </Button>
            }
          />
          <DeleteEntryButton
            label={`Traspaso ${label}`}
            title="¿Eliminar este traspaso?"
            success="Traspaso eliminado"
            onDelete={() => deleteTransfer(workspaceId, transfer.id)}
          />
        </div>
      </Table.Cell>
    </Table.Row>
  )
}

// Ajuste de saldo: neutro, con signo. Solo se elimina.
function AdjustmentRow({
  workspaceId,
  showCounterparty,
  adjustment,
  label,
  currency
}: {
  workspaceId: string
  showCounterparty: boolean
  adjustment: AdjustmentEntry
  label: string
  currency: string
}) {
  return (
    <Table.Row>
      <Table.Cell className="text-muted">
        {formatDate(adjustment.occurred_on)}
      </Table.Cell>
      <DescriptionCell
        title={label}
        note={adjustment.note}
        icon={RefreshCw}
      />
      <Table.Cell className="text-muted">Ajuste</Table.Cell>
      {showCounterparty && <Table.Cell />}
      <Table.Cell />
      <Table.Cell className="text-end font-medium text-muted tabular-nums">
        {adjustment.amount > 0 ? "+" : "−"}
        {formatCurrency(Math.abs(adjustment.amount), currency)}
      </Table.Cell>
      <Table.Cell>
        <div className="flex justify-end gap-1">
          <DeleteEntryButton
            label={label}
            title="¿Eliminar este ajuste?"
            success="Ajuste eliminado"
            onDelete={() => deleteAdjustment(workspaceId, adjustment.id)}
          />
        </div>
      </Table.Cell>
    </Table.Row>
  )
}

function DeleteTransactionButton({
  workspaceId,
  transaction
}: {
  workspaceId: string
  transaction: EditableTransaction
}) {
  return (
    <DeleteEntryButton
      label={transaction.description}
      title="¿Eliminar este movimiento?"
      success="Movimiento eliminado"
      onDelete={() => deleteTransaction(workspaceId, transaction.id)}
    />
  )
}

function DeleteEntryButton({
  label,
  title,
  success,
  onDelete
}: {
  label: string
  title: string
  success: string
  onDelete: () => Promise<{ error?: string }>
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete()
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(success)
      }
    })
  }

  return (
    <AlertDialog>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={`Eliminar ${label}`}
        isDisabled={pending}
      >
        <Trash2 />
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                &ldquo;{label}&rdquo; se eliminará de forma permanente. Esta
                acción no se puede deshacer.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={handleDelete}
              >
                Eliminar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
