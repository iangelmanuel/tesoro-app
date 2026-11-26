"use client"

import { useOptimistic, useState, useTransition } from "react"
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
import type {
  TableDragMove,
  TableDragStart
} from "./transactions-table-dnd-context"

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
  // Fila que se arrastra: queda como hueco en el lugar de destino
  const [activeId, setActiveId] = useState<string | null>(null)

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

  function handleDragStart(start: TableDragStart | null) {
    setDraggingDay(start?.day ?? null)
    setActiveId(start?.id ?? null)
  }

  // null: se canceló o no era una fila de la tabla
  function handleDragEnd(move: TableDragMove | null) {
    setDraggingDay(null)
    setActiveId(null)

    // Una fila solo se mueve entre las de su día, y la RPC deja la fila
    // arrastrada en el lugar de la destino
    if (!move || !move.sameDay || move.index === move.initialIndex) {
      return
    }
    const dayRows = orderedRows.filter((row) => entryDate(row) === move.day)
    const moved = dayRows[move.initialIndex]
    const destination = dayRows[move.index]

    if (moved && destination) {
      moveRow(moved, destination)
    }
  }

  // Sin permiso de escritura o con búsqueda, las filas no tienen asa
  const reorders = canReorder ? rowReorders(orderedRows, draggingDay) : null

  return { orderedRows, reorders, activeId, handleDragStart, handleDragEnd }
}
