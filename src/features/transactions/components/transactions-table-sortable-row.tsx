"use client"

import { useId } from "react"
import { useSortable } from "@dnd-kit/react/sortable"
import { GripVertical } from "lucide-react"
import {
  RowActions,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/data/row-actions"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/libs/cn"
import type { Reorder } from "../ledger-rows"
import {
  type EntryConfig,
  useEntryActions
} from "./transactions-table-row-actions"

/**
 * Fila ordenable con dnd-kit: el asa (⋮⋮) a la izquierda inicia el arrastre
 * con mouse, dedo (mantener presionado) o teclado. Sin `reorder` la tabla no
 * se puede reordenar (búsqueda activa o sin permiso de escritura). La fila
 * entera lleva el menú contextual (clic derecho y pulsación larga) con las
 * mismas acciones que su botón ⋯; el asa no lo abre, así arrastrar y la
 * pulsación larga no chocan
 */
export function SortableRow({
  reorder,
  entry,
  children
}: {
  reorder: Reorder | undefined
  entry: EntryConfig
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
  const { actions, dialogs } = useEntryActions(entry)

  return (
    <RowContextMenu
      label={entry.label}
      actions={actions}
    >
      <TableRow
        // Solo una fila arrastrable se registra en el <tr>. Deshabilitada,
        // dnd-kit le pone aria-disabled="true": el menú de acciones debe
        // seguir alcanzable en las filas solas en su día (SPEC 26)
        ref={reorder?.canDrag ? ref : undefined}
        className={cn(
          "duration-150",
          reorder?.className,
          // La fila original queda como hueco en el lugar de destino
          isDragSource && "bg-primary/15 opacity-50"
        )}
      >
        {reorder ? (
          <TableCell className="ps-2 pe-0">
            {reorder.canDrag ? (
              <button
                ref={handleRef}
                type="button"
                aria-label="Reordenar dentro del día"
                data-tour="transactions-reorder"
                // El asa es solo para arrastrar: ni la pulsación larga ni el
                // clic derecho abren el menú de la fila desde aquí
                onTouchStart={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.stopPropagation()}
                className={cn(
                  "grid h-6 w-5 touch-none place-items-center rounded-md text-muted-foreground/70 outline-none select-none hover:bg-highlight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11 pointer-coarse:w-7",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
              >
                <GripVertical
                  aria-hidden="true"
                  className="size-4"
                />
              </button>
            ) : null}
          </TableCell>
        ) : null}
        {children}
        <TableCell>
          <RowActions
            label={entry.label}
            actions={actions}
          />
          <RowMenuBoundary>{dialogs}</RowMenuBoundary>
        </TableCell>
      </TableRow>
    </RowContextMenu>
  )
}
