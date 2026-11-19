"use client"

import { useId, useOptimistic, useState, useTransition } from "react"
import {
  DragDropProvider,
  type DragEndEvent,
  DragOverlay
} from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { cn, toast } from "@heroui/react"
import { GripVertical } from "lucide-react"

// Listas ordenables de los paneles laterales (SPEC 45): el mismo arrastre de
// Movimientos (SPEC 19), con asa ⋮⋮, resaltado del grupo y vista previa. Una
// fila solo se mueve dentro de su grupo (su día o su tipo de categoría)

/** La fila `sourceId` toma el lugar de `targetId` (sube antes, baja después) */
export function moveItem<T>(
  items: T[],
  getId: (item: T) => string,
  sourceId: string,
  targetId: string
) {
  const from = items.findIndex((item) => getId(item) === sourceId)
  const to = items.findIndex((item) => getId(item) === targetId)
  if (from === -1 || to === -1) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Datos de arrastre de una fila; sin ellos la fila no se puede mover */
export interface SortableConfig {
  id: string
  group: string
  /** Posición de la fila entre las de su grupo */
  index: number
  /** Hay otra fila de su grupo: sin ella no hay nada que reordenar */
  canDrag: boolean
  /** Texto de la vista previa del arrastre */
  title: string
  /** Resaltado mientras se arrastra otra fila */
  className?: string
  /** Etiqueta accesible del asa */
  handleLabel: string
}

interface UseSortableListOptions<T> {
  items: T[]
  getId: (item: T) => string
  getGroup: (item: T) => string
  getTitle: (item: T) => string
  /** Etiqueta del asa: "Reordenar dentro del día" */
  handleLabel: string
  /** false: sin asas (solo lectura) */
  enabled?: boolean
  /** Guarda el cambio; si devuelve error, la fila vuelve a su lugar */
  onMove: (source: T, target: T) => Promise<{ error?: string }>
}

/**
 * Orden optimista y arrastre de una lista. Devuelve las filas en su orden
 * actual, la config de cada una y los eventos para `SortableListProvider`
 */
export function useSortableList<T>({
  items,
  getId,
  getGroup,
  getTitle,
  handleLabel,
  enabled = true,
  onMove
}: UseSortableListOptions<T>) {
  // La fila se mueve al instante; si la action falla, vuelve a su lugar
  const [ordered, moveOptimistic] = useOptimistic(
    items,
    (current: T[], move: { sourceId: string; targetId: string }) =>
      moveItem(current, getId, move.sourceId, move.targetId)
  )
  const [, startTransition] = useTransition()
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null)

  const groupSizes = new Map<string, number>()
  for (const item of ordered) {
    const group = getGroup(item)
    groupSizes.set(group, (groupSizes.get(group) ?? 0) + 1)
  }
  const groupIndexes = new Map<string, number>()
  const configs = new Map<string, SortableConfig>()
  for (const item of ordered) {
    const group = getGroup(item)
    const index = groupIndexes.get(group) ?? 0
    groupIndexes.set(group, index + 1)
    configs.set(getId(item), {
      id: getId(item),
      group,
      index,
      canDrag: (groupSizes.get(group) ?? 0) > 1,
      title: getTitle(item),
      handleLabel,
      // Las filas del mismo grupo se resaltan como zona de soltado; el resto
      // se atenúa mientras se arrastra
      className: draggingGroup
        ? group === draggingGroup
          ? "bg-accent/10"
          : "opacity-40"
        : undefined
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingGroup(null)
    const source = event.operation.source
    if (event.canceled || !isSortable(source)) return
    if (
      source.group !== source.initialGroup ||
      source.index === source.initialIndex
    ) {
      return
    }
    const groupItems = ordered.filter(
      (item) => getGroup(item) === String(source.group)
    )
    const moved = groupItems[source.initialIndex]
    const destination = groupItems[source.index]
    if (!moved || !destination) return

    startTransition(async () => {
      moveOptimistic({
        sourceId: getId(moved),
        targetId: getId(destination)
      })
      const result = await onMove(moved, destination)
      if (result.error) {
        toast.danger(result.error)
      }
    })
  }

  return {
    items: ordered,
    /** Config de arrastre de la fila; undefined si la lista no se ordena */
    configFor: (item: T) => (enabled ? configs.get(getId(item)) : undefined),
    providerProps: {
      onDragStart: (group: string | null) => setDraggingGroup(group),
      onDragEnd: handleDragEnd
    }
  }
}

/** Contexto de arrastre y vista previa de una lista ordenable */
export function SortableListProvider({
  onDragStart,
  onDragEnd,
  children
}: {
  onDragStart: (group: string | null) => void
  onDragEnd: (event: DragEndEvent) => void
  children: React.ReactNode
}) {
  return (
    <DragDropProvider
      onDragStart={(event) => {
        const source = event.operation.source
        onDragStart(isSortable(source) ? String(source.group) : null)
      }}
      onDragEnd={onDragEnd}
    >
      {children}
      <DragOverlay>
        {(source) => (
          <div className="flex w-fit max-w-full items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 text-sm font-medium shadow-overlay ring-1 ring-accent">
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

/**
 * Fila `<li>` ordenable. `children` recibe el asa (o null) para ponerla
 * donde vaya en la fila: con mouse, dedo (mantener presionado) o teclado
 */
export function SortableListItem({
  config,
  className,
  children
}: {
  config: SortableConfig | undefined
  className?: string
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const fallbackId = useId()
  const { ref, handleRef, isDragging, isDragSource } = useSortable({
    id: config?.id ?? fallbackId,
    index: config?.index ?? 0,
    // Grupo y tipo por grupo: una fila nunca interactúa con las de otro
    group: config?.group,
    type: config?.group ?? fallbackId,
    accept: config?.group ? [config.group] : undefined,
    data: { title: config?.title },
    disabled: !config?.canDrag
  })

  const handle = config?.canDrag ? (
    <button
      ref={handleRef}
      type="button"
      aria-label={config.handleLabel}
      className={cn(
        "grid h-6 w-5 shrink-0 touch-none place-items-center rounded-md text-muted/50 outline-none select-none hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus pointer-coarse:h-11 pointer-coarse:w-7",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      <GripVertical
        aria-hidden="true"
        className="size-4"
      />
    </button>
  ) : null

  return (
    <li
      // Solo una fila arrastrable se registra: así una fila sola en su grupo
      // no queda con aria-disabled
      ref={config?.canDrag ? ref : undefined}
      className={cn(
        "transition-colors duration-150 motion-reduce:transition-none",
        className,
        config?.className,
        // La fila original queda como hueco en el lugar de destino
        isDragSource && "bg-accent/15 opacity-50"
      )}
    >
      {children(handle)}
    </li>
  )
}
