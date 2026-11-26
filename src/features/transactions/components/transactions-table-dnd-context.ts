"use client"

import { createContext, useContext } from "react"

/** Elementos de una fila que engancha el arrastre: el `<tr>` y su asa */
export interface RowElements {
  row: { current: Element | null }
  handle: { current: Element | null }
}

/** Fila que empieza a arrastrarse */
export interface TableDragStart {
  id: string
  day: string
}

/** Resultado de soltar una fila */
export interface TableDragMove {
  day: string
  /** Se soltó en su mismo día */
  sameDay: boolean
  index: number
  initialIndex: number
}

interface TableDndValue {
  /** El chunk de @dnd-kit ya cargó: el asa se puede usar */
  ready: boolean
  /** Llave de la fila que se arrastra */
  activeId: string | null
  /** Guarda el `<tr>` o el asa de la fila `id` (ref callback) */
  register: (
    id: string,
    part: keyof RowElements,
    element: Element | null
  ) => void
}

/**
 * Arrastre de la tabla de Movimientos (SPEC 56b). @dnd-kit llega en idle
 * después de hidratar: hasta entonces `ready` es false y el asa está
 * `disabled`. Las filas no cambian al llegar: el proveedor y los
 * `useSortable` viven al lado de la tabla y enganchan los elementos de cada
 * fila, así nada se remonta ni pierde el foco
 */
export const TableDndContext = createContext<TableDndValue>({
  ready: false,
  activeId: null,
  register: () => {}
})

export function useTableDnd() {
  return useContext(TableDndContext)
}

/**
 * Elementos de cada fila, un objeto estable por fila: dnd-kit lee
 * `current` después del commit, cuando la fila ya registró su `<tr>`
 */
export function createRowElementsStore() {
  const store = new Map<string, RowElements>()

  function elementsFor(id: string) {
    let elements = store.get(id)
    if (!elements) {
      elements = { row: { current: null }, handle: { current: null } }
      store.set(id, elements)
    }
    return elements
  }

  function register(
    id: string,
    part: keyof RowElements,
    element: Element | null
  ) {
    elementsFor(id)[part].current = element
  }

  return { elementsFor, register }
}
