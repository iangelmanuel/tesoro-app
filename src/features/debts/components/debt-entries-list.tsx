"use client"

import { Receipt } from "lucide-react"
import {
  SortableListProvider,
  useSortableList
} from "@/components/dashboard/data/sortable-list"
import { CARD_LIST } from "@/components/dashboard/data/surface"
import { CardEmpty } from "@/components/dashboard/feedback/empty-state"
import type { PaymentAccountOption } from "@/features/accounts/components/payment-account-section"
import type { Category } from "@/features/categories/queries"
import { formatDate, formatMonthLong } from "@/libs/format"
import { moveDebtEntry } from "../entry-actions"
import { type EntriesDebt, entryLabel, groupByMonth } from "../entry-list"
import type { DebtEntry } from "../queries"
import { type CollectableReceivable } from "../receivable-collect"
import { DebtEntriesListRow } from "./debt-entries-list-row"

interface DebtEntriesListProps {
  debt: EntriesDebt
  entries: DebtEntry[]
  /** Cuentas activas, para cambiar la cuenta de un pago (SPEC 42) */
  accounts?: PaymentAccountOption[]
  /** Categorías del espacio, para el movimiento de un pago (SPEC 42) */
  categories?: Category[]
  currency: string
  /**
   * La cuota del ciclo actual ya está cubierta: el duplicado de un pago
   * muestra un aviso (SPEC 49)
   */
  cycleCovered?: boolean
  /**
   * Me deben mensual: sus cuotas, para que el duplicado de un cobro cubra la
   * siguiente pendiente (SPEC 49)
   */
  collectable?: CollectableReceivable
  /** Deudas pagadas, cobradas o archivadas: sin editar ni eliminar */
  readOnly?: boolean
}

export function DebtEntriesList({
  debt,
  entries,
  accounts,
  categories,
  currency,
  cycleCovered = false,
  collectable,
  readOnly
}: DebtEntriesListProps) {
  // Orden manual dentro del día (SPEC 45), como en Movimientos
  const sortable = useSortableList({
    items: entries,
    getId: (entry) => entry.id,
    getGroup: (entry) => entry.occurred_on,
    getTitle: (entry) =>
      `${entryLabel(debt, entry)} · ${formatDate(entry.occurred_on)}`,
    handleLabel: "Reordenar dentro del día",
    enabled: !readOnly,
    onMove: (source, target) => moveDebtEntry(source.id, target.id)
  })

  if (entries.length === 0) {
    return (
      <CardEmpty
        icon={Receipt}
        message="Aún no hay movimientos registrados"
      />
    )
  }

  return (
    <SortableListProvider {...sortable.providerProps}>
      {/* Como un extracto: por mes, del más reciente al más antiguo. El orden
          manual es dentro del día, así que nunca cruza de un mes a otro */}
      <div className="flex flex-col gap-5">
        {groupByMonth(sortable.items).map(([month, monthEntries]) => (
          <section
            key={month}
            aria-label={formatMonthLong(month)}
            className="flex flex-col gap-2"
          >
            <h4 className="text-xs font-medium text-muted-foreground first-letter:uppercase">
              {formatMonthLong(month)}
            </h4>
            <ul className={CARD_LIST}>
              {monthEntries.map((entry) => (
                <DebtEntriesListRow
                  key={entry.id}
                  debt={debt}
                  entry={entry}
                  accounts={accounts}
                  categories={categories}
                  currency={currency}
                  cycleCovered={cycleCovered}
                  collectable={collectable}
                  readOnly={readOnly}
                  sortable={sortable.configFor(entry)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SortableListProvider>
  )
}
