"use client"

import { useOptimistic, useState, useTransition } from "react"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"
import { toast } from "@/components/ui/sonner"
import { moveLedgerEntry } from "../ledger-actions"
import {
  entryDate,
  entryId,
  reorderRows,
  rowKey,
  rowReorders
} from "../ledger-rows"
import type { LedgerEntry } from "../types"

/**
 * Orden manual de la tabla de Movimientos (SPEC 19): la fila se mueve al
 * instante y, si la action falla, vuelve a su lugar
 */
export function useTransactionsTable(
  workspaceId: string,
  rows: LedgerEntry[],
  canReorder: boolean
) {
  const [orderedRows, moveOptimistic] = useOptimistic(rows, reorderRows)
  const [, startTransition] = useTransition()
  // Día de la fila que se arrastra: solo se puede soltar dentro de él
  const [draggingDay, setDraggingDay] = useState<string | null>(null)

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
        toast.error(result.error)
      }
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source
    setDraggingDay(isSortable(source) ? String(source.group) : null)
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

  // Sin permiso de escritura o con búsqueda, las filas no tienen asa
  const reorders = canReorder ? rowReorders(orderedRows, draggingDay) : null

  return { orderedRows, reorders, handleDragStart, handleDragEnd }
}
