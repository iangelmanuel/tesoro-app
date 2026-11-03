"use client"

import { useId, useOptimistic, useState, useTransition } from "react"
import {
  DragDropProvider,
  type DragEndEvent,
  DragOverlay
} from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { AlertDialog, Button, Table, cn, toast } from "@heroui/react"
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  GripVertical,
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
import { formatCurrency, formatDate, formatTime } from "@/libs/format"
import { deleteTransaction, moveLedgerEntry } from "../actions"
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
  /** Muestra ↑/↓ para reordenar dentro del día: con permiso de escritura y sin búsqueda */
  canReorder?: boolean
}

// A 375 px la tabla no se desborda: la fecha pasa bajo la descripción y
// categoría, cliente y cuenta se ocultan hasta que hay espacio
const FROM_SM = "hidden sm:table-cell"
const FROM_MD = "hidden md:table-cell"
const FROM_LG = "hidden lg:table-cell"

// Botones de fila: 32 px con mouse, 40 px en pantallas táctiles
const ROW_ACTION = "pointer-coarse:size-10"

/** Reordenar una fila dentro de su día arrastrando su asa (⋮⋮) */
interface Reorder {
  /** Llave de la fila: `kind:id` */
  id: string
  day: string
  /** Posición de la fila entre las de su mismo día a la vista */
  index: number
  /** Hay otra fila de su día a la vista: sin ella no hay nada que reordenar */
  canDrag: boolean
  /** Texto de la fila para la vista previa del arrastre */
  title: string
  /** Resaltado mientras se arrastra otra fila */
  className?: string
}

// El id de la fila en su tabla de origen (el mismo que usa move_ledger_entry)
function entryId(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.id : row.id
}

function entryDate(row: LedgerEntry) {
  return "transaction" in row ? row.transaction.occurred_on : row.occurred_on
}

function rowKey(row: LedgerEntry) {
  return `${row.kind}:${entryId(row)}`
}

// Texto corto de la fila para la vista previa del arrastre
function rowTitle(row: LedgerEntry) {
  if ("transaction" in row) {
    return row.transaction.description
  }
  switch (row.kind) {
    case "transfer":
      return "Traspaso"
    case "adjustment":
      return "Ajuste de saldo"
    default:
      return describeAccountMovement(row).title
  }
}

// La fila origen toma el lugar de la destino: sube antes de ella, baja después
function reorderRows(
  current: LedgerEntry[],
  move: { sourceKey: string; targetKey: string }
) {
  const from = current.findIndex((row) => rowKey(row) === move.sourceKey)
  const to = current.findIndex((row) => rowKey(row) === move.targetKey)

  if (from === -1 || to === -1) {
    return current
  }

  const next = [...current]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

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
  currency,
  canReorder = false
}: TransactionsTableProps) {
  // La fila se mueve al instante; si la action falla, vuelve a su lugar
  const [orderedRows, moveOptimistic] = useOptimistic(rows, reorderRows)
  const [, startTransition] = useTransition()
  // Día de la fila que se arrastra: solo se puede soltar dentro de él
  const [draggingDay, setDraggingDay] = useState<string | null>(null)
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  )
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const accountName = (id: string) => accountsById.get(id)?.name ?? "Cuenta"
  const isBusiness = workspaceType === "business"

  function moveRow(source: LedgerEntry, target: LedgerEntry) {
    startTransition(async () => {
      moveOptimistic({ sourceKey: rowKey(source), targetKey: rowKey(target) })
      const result = await moveLedgerEntry(
        workspaceId,
        source.kind,
        entryId(source),
        target.kind,
        entryId(target)
      )
      if (result.error) {
        toast.danger(result.error)
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingDay(null)
    const source = event.operation.source

    if (event.canceled || !isSortable(source)) {
      return
    }
    // Una fila solo se mueve entre las de su día, y la RPC deja la fila
    // arrastrada en el lugar de la destino
    if (
      source.group !== source.initialGroup ||
      source.index === source.initialIndex
    ) {
      return
    }
    const dayRows = orderedRows.filter(
      (row) => entryDate(row) === String(source.group)
    )
    const moved = dayRows[source.initialIndex]
    const destination = dayRows[source.index]

    if (moved && destination) {
      moveRow(moved, destination)
    }
  }

  // Las filas del mismo día se resaltan como zona de soltado; el resto se
  // atenúa mientras se arrastra
  function dragClassName(day: string) {
    if (!draggingDay) {
      return undefined
    }
    return day === draggingDay ? "bg-accent/10" : "opacity-40"
  }

  // Posición de cada fila entre las de su día, para el orden de dnd-kit
  const dayCounts = new Map<string, number>()

  // Un día de una sola fila a la vista no tiene asa
  function reorderFor(index: number): Reorder | undefined {
    if (!canReorder) {
      return undefined
    }
    const row = orderedRows[index]
    const day = entryDate(row)
    const previous = orderedRows[index - 1]
    const next = orderedRows[index + 1]
    const dayIndex = dayCounts.get(day) ?? 0
    dayCounts.set(day, dayIndex + 1)

    return {
      id: rowKey(row),
      day,
      index: dayIndex,
      canDrag: Boolean(
        (previous && entryDate(previous) === day) ||
        (next && entryDate(next) === day)
      ),
      title: rowTitle(row),
      className: dragClassName(day)
    }
  }

  return (
    <DragDropProvider
      onDragStart={(event) => {
        const source = event.operation.source
        setDraggingDay(isSortable(source) ? String(source.group) : null)
      }}
      onDragEnd={handleDragEnd}
    >
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Movimientos"
            className="[&_tbody_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 motion-reduce:[&_tbody_tr]:transition-none [&_tbody_tr:hover]:bg-default/40"
          >
            <Table.Header>
              {canReorder ? (
                <Table.Column className="w-7 ps-2 pe-0">
                  <span className="sr-only">Orden</span>
                </Table.Column>
              ) : null}
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
              {orderedRows.map((row, index) => {
                if (row.kind === "transfer") {
                  return (
                    <TransferRow
                      key={row.id}
                      workspaceId={workspaceId}
                      showCounterparty={isBusiness}
                      transfer={row}
                      reorder={reorderFor(index)}
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
                      reorder={reorderFor(index)}
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
                      reorder={reorderFor(index)}
                      label={`Ajuste de saldo · ${accountName(row.account_id)}`}
                      currency={currency}
                    />
                  )
                }

                const transaction = row.transaction
                const reorder = reorderFor(index)
                const category = categoriesById.get(transaction.category_id)
                const account = transaction.account_id
                  ? accountsById.get(transaction.account_id)
                  : undefined

                return (
                  <SortableRow
                    key={transaction.id}
                    reorder={reorder}
                  >
                    <DateCell
                      date={transaction.occurred_on}
                      time={row.occurred_time}
                    />
                    <DescriptionCell
                      title={transaction.description}
                      note={transaction.note}
                      date={transaction.occurred_on}
                      time={row.occurred_time}
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
                  </SortableRow>
                )
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <DragOverlay>
        {(source) => (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 text-sm font-medium shadow-lg ring-1 ring-accent">
            <GripVertical
              aria-hidden="true"
              className="size-4 text-muted"
            />
            {String(source.data?.title ?? "")}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
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

// Fila ordenable con dnd-kit: el asa (⋮⋮) a la izquierda inicia el arrastre
// con mouse, dedo (mantener presionado) o teclado. Sin `reorder` la tabla no
// se puede reordenar (búsqueda activa o sin permiso de escritura).
function SortableRow({
  reorder,
  children
}: {
  reorder: Reorder | undefined
  children: React.ReactNode
}) {
  const fallbackId = useId()
  const { ref, handleRef, isDragging, isDragSource } = useSortable({
    id: reorder?.id ?? fallbackId,
    index: reorder?.index ?? 0,
    // Grupo y tipo por día: una fila nunca interactúa con las de otro día
    group: reorder?.day,
    type: reorder?.day ?? fallbackId,
    accept: reorder?.day ? [reorder.day] : undefined,
    data: { title: reorder?.title },
    disabled: !reorder?.canDrag
  })

  return (
    <Table.Row
      ref={ref}
      className={cn(
        reorder?.className,
        // La fila original queda como hueco en el lugar de destino
        isDragSource && "bg-accent/15 opacity-50"
      )}
    >
      {reorder ? (
        <Table.Cell className="ps-2 pe-0">
          {reorder.canDrag ? (
            <button
              ref={handleRef}
              type="button"
              aria-label="Reordenar dentro del día"
              className={cn(
                "grid h-6 w-5 touch-none place-items-center rounded-md text-muted/50 outline-none select-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:h-11 pointer-coarse:w-7",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
            >
              <GripVertical
                aria-hidden="true"
                className="size-4"
              />
            </button>
          ) : null}
        </Table.Cell>
      ) : null}
      {children}
    </Table.Row>
  )
}

// Fecha y, debajo, la hora si el usuario la puso
function DateCell({ date, time }: { date: string; time: string | null }) {
  return (
    <Table.Cell className={cn("text-muted", FROM_SM)}>
      {formatDate(date)}
      {time && <span className="block text-xs">{formatTime(time)}</span>}
    </Table.Cell>
  )
}

function DescriptionCell({
  title,
  note,
  date,
  time,
  icon: Icon
}: {
  title: string
  note: string | null
  /** Bajo el título solo en móvil, donde la columna Fecha se oculta */
  date: string
  time: string | null
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
        {time && ` · ${formatTime(time)}`}
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
  return (
    <SortableRow reorder={reorder}>
      <DateCell
        date={transfer.occurred_on}
        time={transfer.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={transfer.note}
        date={transfer.occurred_on}
        time={transfer.occurred_time}
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
    </SortableRow>
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
  currency,
  reorder
}: {
  showCounterparty: boolean
  entry: AccountMovementEntry
  account: PaymentAccountOption | undefined
  currency: string
  reorder: Reorder | undefined
}) {
  const { title, type, icon, increases } = describeAccountMovement(entry)

  return (
    <SortableRow reorder={reorder}>
      <DateCell
        date={entry.occurred_on}
        time={entry.occurred_time}
      />
      <DescriptionCell
        title={title}
        note={entry.note}
        date={entry.occurred_on}
        time={entry.occurred_time}
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
    </SortableRow>
  )
}

// Ajuste de saldo: neutro, con signo. Solo se elimina.
function AdjustmentRow({
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
  return (
    <SortableRow reorder={reorder}>
      <DateCell
        date={adjustment.occurred_on}
        time={adjustment.occurred_time}
      />
      <DescriptionCell
        title={label}
        note={adjustment.note}
        date={adjustment.occurred_on}
        time={adjustment.occurred_time}
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
    </SortableRow>
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
