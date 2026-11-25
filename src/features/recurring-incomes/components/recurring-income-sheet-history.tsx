"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Amount } from "@/components/dashboard/data/amount"
import {
  SortableListItem,
  SortableListProvider,
  moveItem,
  useSortableList
} from "@/components/dashboard/data/sortable-list"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/data/surface"
import { TONE_TEXT_CLASSES } from "@/components/dashboard/feedback/tone"
import { Button } from "@/components/ui/button"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { RecordedPaymentActions } from "@/features/transactions/components/recorded-payment-actions"
import { moveLedgerEntry } from "@/features/transactions/ledger-actions"
import { cn } from "@/libs/cn"
import { formatShortDate } from "@/libs/format"
import type {
  IncomeHistoryRow,
  IncomeReceipt,
  RecurringIncomeHistory
} from "../income-history"
import { shortOccurrenceDate } from "../occurrences"
import type { IncomeSourceOption } from "../queries"
import { IncomeStatusBadge, PartialDetail } from "./income-status"

/** Lo que necesitan Editar, Duplicar y Eliminar de un cobro registrado (SPEC 42 y 49) */
interface ReceiptEditing {
  workspaceId: string
  categories: Category[]
  accounts: PaymentAccountOption[]
  incomeSources: IncomeSourceOption[]
  /** Queda un periodo abierto donde repartir el duplicado */
  canDuplicate: boolean
  onChanged: () => void
}

/** Periodos de un ingreso fijo en su Sheet, el más reciente primero (SPEC 38) */
export function RecurringIncomeSheetHistory({
  history,
  currency,
  editing,
  onReceive,
  onShowMore
}: {
  history: RecurringIncomeHistory
  currency: string
  editing: ReceiptEditing
  /** Sin él (fuente pausada) no se muestra **Recibir** */
  onReceive?: (row: IncomeHistoryRow) => void
  onShowMore: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {history.occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no tiene periodos: empieza más adelante.
        </p>
      ) : (
        <ul className={CARD_LIST}>
          {history.occurrences.map((row) => (
            <HistoryRow
              key={row.dueOn}
              row={row}
              currency={currency}
              editing={editing}
              onReceive={onReceive}
            />
          ))}
        </ul>
      )}

      {history.hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onShowMore}
        >
          Ver más
        </Button>
      )}
    </div>
  )
}

function HistoryRow({
  row,
  currency,
  editing,
  onReceive
}: {
  row: IncomeHistoryRow
  currency: string
  editing: ReceiptEditing
  onReceive?: (row: IncomeHistoryRow) => void
}) {
  const isReceived = row.status === "received"

  return (
    <li className={cn(CARD_ROW, "flex flex-col gap-2")}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium first-letter:uppercase">
              {shortOccurrenceDate(row.dueOn)}
            </span>
            <IncomeStatusBadge status={row.status} />
          </div>
          {row.status === "partial" && (
            <p className="text-xs text-muted-foreground">
              <PartialDetail
                received={row.receivedAmount}
                expected={row.amount}
                remaining={row.remaining}
                currency={currency}
              />
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isReceived ? (
            <span
              className={cn("text-sm font-medium", TONE_TEXT_CLASSES.success)}
            >
              <Amount
                value={row.receivedAmount}
                currency={currency}
              />
            </span>
          ) : (
            onReceive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReceive(row)}
              >
                <Check />
                Recibir
              </Button>
            )
          )}
        </div>
      </div>

      {row.receipts.length > 0 && (
        <ReceiptsList
          // Otra lista del servidor (recarga del historial) reinicia el orden
          key={row.receipts.map((receipt) => receipt.transactionId).join()}
          receipts={row.receipts}
          currency={currency}
          editing={editing}
        />
      )}
    </li>
  )
}

/**
 * Movimientos que cubren una ocurrencia (un cobro puede cubrir varias). Cada
 * uno se edita o elimina aparte (SPEC 42) y los del mismo día se reordenan
 * como en Movimientos (SPEC 45)
 */
function ReceiptsList({
  receipts,
  currency,
  editing
}: {
  receipts: IncomeReceipt[]
  currency: string
  editing: ReceiptEditing
}) {
  // El historial se carga en el cliente: el orden guardado se queda aquí
  // sin esperar a recargarlo
  const [items, setItems] = useState(receipts)
  const getId = (receipt: IncomeReceipt) => receipt.transactionId
  const sortable = useSortableList({
    items,
    getId,
    getGroup: (receipt) => receipt.occurredOn,
    getTitle: (receipt) => receipt.description,
    handleLabel: "Reordenar dentro del día",
    onMove: async (source, target) => {
      const result = await moveLedgerEntry(
        editing.workspaceId,
        "income",
        source.transactionId,
        "income",
        target.transactionId
      )
      if (!result.error) {
        setItems((current) =>
          moveItem(current, getId, source.transactionId, target.transactionId)
        )
      }
      return result
    }
  })

  return (
    <SortableListProvider {...sortable.providerProps}>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {sortable.items.map((receipt) => (
          <SortableListItem
            key={receipt.transactionId}
            config={sortable.configFor(receipt)}
            className="flex items-center justify-between gap-2 rounded-lg tabular-nums"
          >
            {(handle) => (
              <>
                <span className="flex min-w-0 items-center gap-1">
                  {handle}
                  <span className="min-w-0">
                    {receipt.description} ·{" "}
                    {formatShortDate(receipt.occurredOn)} ·{" "}
                    <Amount
                      value={receipt.amount}
                      currency={currency}
                    />
                  </span>
                </span>
                <RecordedPaymentActions
                  {...editing}
                  transactionId={receipt.transactionId}
                  noun="cobro"
                  deleteEffect={
                    receipts.length > 1
                      ? "el periodo queda parcial con los demás cobros"
                      : "el periodo vuelve a quedar por recibir"
                  }
                />
              </>
            )}
          </SortableListItem>
        ))}
      </ul>
    </SortableListProvider>
  )
}
