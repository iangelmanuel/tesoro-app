"use client"

import { DragDropProvider, DragOverlay } from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { GripVertical } from "lucide-react"
import type { Reorder } from "../ledger-rows"
import type {
  RowElements,
  TableDragMove,
  TableDragStart
} from "./transactions-table-dnd-context"

interface TableDndProps {
  reorders: Reorder[]
  elementsFor: (id: string) => RowElements
  onDragStart: (start: TableDragStart | null) => void
  onDragEnd: (move: TableDragMove | null) => void
}

/**
 * Arrastre de la tabla de Movimientos con dnd-kit (SPEC 19). Lo carga
 * TransactionsTable en idle (SPEC 56b) y se monta al lado de la tabla: cada
 * fila arrastrable registra su `<tr>` y su asa, y aquí un `useSortable` por
 * fila los engancha. El asa inicia el arrastre con mouse, dedo (mantener
 * presionado) o teclado
 */
export function TableDnd({
  reorders,
  elementsFor,
  onDragStart,
  onDragEnd
}: TableDndProps) {
  return (
    <DragDropProvider
      onDragStart={(event) => {
        const source = event.operation.source
        onDragStart(
          isSortable(source)
            ? { id: String(source.id), day: String(source.group) }
            : null
        )
      }}
      onDragEnd={(event) => {
        const source = event.operation.source
        if (event.canceled || !isSortable(source)) {
          onDragEnd(null)
          return
        }
        onDragEnd({
          day: String(source.group),
          sameDay: source.group === source.initialGroup,
          index: source.index,
          initialIndex: source.initialIndex
        })
      }}
    >
      {reorders
        .filter((reorder) => reorder.canDrag)
        .map((reorder) => (
          <SortableBinding
            key={reorder.id}
            reorder={reorder}
            elements={elementsFor(reorder.id)}
          />
        ))}
      <DragOverlay>
        {(source) => (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl bg-popover px-4 py-2.5 text-sm font-medium shadow-(--overlay-shadow) ring-1 ring-ring">
            <GripVertical
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            {String(source.data?.title ?? "")}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
  )
}

/** Engancha la fila y su asa: no pinta nada */
function SortableBinding({
  reorder,
  elements
}: {
  reorder: Reorder
  elements: RowElements
}) {
  useSortable({
    id: reorder.id,
    index: reorder.index,
    // Grupo y tipo por día: una fila nunca interactúa con las de otro día
    group: reorder.day,
    type: reorder.day,
    accept: [reorder.day],
    data: { title: reorder.title },
    element: elements.row,
    handle: elements.handle
  })
  return null
}
