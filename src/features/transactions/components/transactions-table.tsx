"use client"

import { useTransition } from "react"
import { AlertDialog, Button, Table, cn, toast } from "@heroui/react"
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Pencil,
  PiggyBank,
  RefreshCw,
  Trash2
} from "lucide-react"
import { deleteAdjustment, deleteTransfer } from "@/features/accounts/actions"
import { AccountLabel } from "@/features/accounts/components/account-select"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import { TransferDialog } from "@/features/accounts/components/transfer-dialog"
import { CategoryBadge } from "@/features/categories/components/category-badge"
import type { Category } from "@/features/categories/queries"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { formatCurrency, formatDate } from "@/libs/format"
import { deleteTransaction } from "../actions"
import {
  type AccountMovementKind,
  type EditableTransaction,
  type LedgerEntry
} from "../queries"
import { TransactionDialog } from "./transaction-dialog"

interface TransactionsTableProps {
  workspaceId: string
  /** En Empresa se muestran cliente/proveedor y factura */
  workspaceType?: WorkspaceType
  rows: LedgerEntry[]
  categories: Category[]
  /** Cuentas del espacio, activas y archivadas */
  accounts: PaymentAccountOption[]
  currency: string
}

// A 375 px la tabla no se desborda: la fecha pasa bajo la descripción y
// categoría, cliente y cuenta se ocultan hasta que hay espacio
const FROM_SM = "hidden sm:table-cell"
const FROM_MD = "hidden md:table-cell"
const FROM_LG = "hidden lg:table-cell"

// Botones de fila: 32 px con mouse, 40 px en pantallas táctiles
const ROW_ACTION = "pointer-coarse:size-10"

type TransferEntry = Extract<LedgerEntry, { kind: "transfer" }>
type AdjustmentEntry = Extract<LedgerEntry, { kind: "adjustment" }>
type AccountMovementEntry = Extract<LedgerEntry, { kind: AccountMovementKind }>

// Pagos, avances y aportes con cuenta: el texto de la fila y si el saldo de la
// cuenta sube (+) o baja (−). Un retiro de meta (monto < 0) entra a la cuenta.
function describeAccountMovement(entry: AccountMovementEntry) {
  switch (entry.kind) {
    case "debt_payment":
      return {
        title: `Pago · ${entry.name}`,
        type: "Pago de tarjeta",
        icon: CreditCard,
        increases: false
      }
    case "debt_advance":
      return {
        title: `Avance · ${entry.name}`,
        type: "Avance de tarjeta",
        icon: Banknote,
        increases: true
      }
    case "goal_contribution":
      return entry.amount < 0
        ? {
            title: `Retiro · ${entry.name}`,
            type: "Retiro de meta",
            icon: PiggyBank,
            increases: true
          }
        : {
            title: `Aporte · ${entry.name}`,
            type: "Aporte a meta",
            icon: PiggyBank,
            increases: false
          }
  }
}

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
          className="[&_tbody_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 motion-reduce:[&_tbody_tr]:transition-none [&_tbody_tr:hover]:bg-default/40"
        >
          <Table.Header>
            <Table.Column className={cn("w-32", FROM_SM)}>Fecha</Table.Column>
            <Table.Column isRowHeader>Descripción</Table.Column>
            <Table.Column className={FROM_MD}>Categoría</Table.Column>
            {isBusiness ? (
              <Table.Column className={FROM_LG}>
                Cliente o proveedor
              </Table.Column>
            ) : null}
            <Table.Column className={FROM_LG}>Cuenta</Table.Column>
            <Table.Column className="text-end">Monto</Table.Column>
            <Table.Column className="w-20">
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
              if (isAccountMovement(row)) {
                return (
                  <AccountMovementRow
                    key={row.id}
                    showCounterparty={isBusiness}
                    entry={row}
                    account={accountsById.get(row.account_id)}
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
                  <Table.Cell className={cn("text-muted", FROM_SM)}>
                    {formatDate(transaction.occurred_on)}
                  </Table.Cell>
                  <DescriptionCell
                    title={transaction.description}
                    note={transaction.note}
                    date={transaction.occurred_on}
                  />
                  <Table.Cell className={FROM_MD}>
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
                  <Table.Cell className={FROM_LG}>
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
                    <div className="flex justify-end gap-1 pointer-coarse:gap-2">
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
                            className={ROW_ACTION}
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
      <Table.Cell className={FROM_LG}>
        <span className="text-muted">—</span>
      </Table.Cell>
    )
  }
  return (
    <Table.Cell className={cn("max-w-48", FROM_LG)}>
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
  date,
  icon: Icon
}: {
  title: string
  note: string | null
  /** Bajo el título solo en móvil, donde la columna Fecha se oculta */
  date: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Table.Cell className="max-w-40 sm:max-w-64">
      <p className="flex items-center gap-2 truncate font-medium">
        {Icon && <Icon className="size-4 shrink-0 text-muted" />}
        <span className="truncate">{title}</span>
      </p>
      <p className="truncate text-xs text-muted sm:hidden">
        {formatDate(date)}
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
  accounts: PaymentAccountOption[]
  currency: string
}) {
  return (
    <Table.Row>
      <Table.Cell className={cn("text-muted", FROM_SM)}>
        {formatDate(transfer.occurred_on)}
      </Table.Cell>
      <DescriptionCell
        title={label}
        note={transfer.note}
        date={transfer.occurred_on}
        icon={ArrowLeftRight}
      />
      <Table.Cell className={cn("text-muted", FROM_MD)}>Traspaso</Table.Cell>
      {showCounterparty && <Table.Cell className={FROM_LG} />}
      <Table.Cell className={FROM_LG} />
      <Table.Cell className="text-end font-medium text-muted tabular-nums">
        {formatCurrency(transfer.amount, currency)}
      </Table.Cell>
      <Table.Cell>
        <div className="flex justify-end gap-1 pointer-coarse:gap-2">
          <TransferDialog
            workspaceId={workspaceId}
            accounts={accounts}
            transfer={transfer}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className={ROW_ACTION}
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

function isAccountMovement(row: LedgerEntry): row is AccountMovementEntry {
  return (
    row.kind === "debt_payment" ||
    row.kind === "debt_advance" ||
    row.kind === "goal_contribution"
  )
}

// Pago de tarjeta, avance o aporte con cuenta: gris, con signo según el saldo
// de la cuenta, de solo lectura. No suma a los totales.
function AccountMovementRow({
  showCounterparty,
  entry,
  account,
  currency
}: {
  showCounterparty: boolean
  entry: AccountMovementEntry
  account: PaymentAccountOption | undefined
  currency: string
}) {
  const { title, type, icon, increases } = describeAccountMovement(entry)

  return (
    <Table.Row>
      <Table.Cell className={cn("text-muted", FROM_SM)}>
        {formatDate(entry.occurred_on)}
      </Table.Cell>
      <DescriptionCell
        title={title}
        note={entry.note}
        date={entry.occurred_on}
        icon={icon}
      />
      <Table.Cell className={cn("text-muted", FROM_MD)}>{type}</Table.Cell>
      {showCounterparty && <Table.Cell className={FROM_LG} />}
      <Table.Cell className={FROM_LG}>
        {account && <AccountLabel account={account} />}
      </Table.Cell>
      <Table.Cell className="text-end font-medium text-muted tabular-nums">
        {increases ? "+" : "−"}
        {formatCurrency(Math.abs(entry.amount), currency)}
      </Table.Cell>
      {/* Se edita desde la deuda o la meta */}
      <Table.Cell />
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
      <Table.Cell className={cn("text-muted", FROM_SM)}>
        {formatDate(adjustment.occurred_on)}
      </Table.Cell>
      <DescriptionCell
        title={label}
        note={adjustment.note}
        date={adjustment.occurred_on}
        icon={RefreshCw}
      />
      <Table.Cell className={cn("text-muted", FROM_MD)}>Ajuste</Table.Cell>
      {showCounterparty && <Table.Cell className={FROM_LG} />}
      <Table.Cell className={FROM_LG} />
      <Table.Cell className="text-end font-medium text-muted tabular-nums">
        {adjustment.amount > 0 ? "+" : "−"}
        {formatCurrency(Math.abs(adjustment.amount), currency)}
      </Table.Cell>
      <Table.Cell>
        <div className="flex justify-end gap-1 pointer-coarse:gap-2">
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
        className={ROW_ACTION}
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
