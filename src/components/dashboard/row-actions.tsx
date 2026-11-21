"use client"

import type { ReactElement, ReactNode } from "react"
import { EllipsisVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/libs/cn"

export interface RowAction {
  id: string
  label: string
  icon: ReactNode
  onAction: () => void
  /** Acción destructiva: va al final del menú y con tono `danger` */
  destructive?: boolean
  isDisabled?: boolean
}

interface RowActionsProps {
  /** Nombre de la fila para el `aria-label` ("Acciones de <fila>") */
  label: string
  actions: RowAction[]
}

// Las destructivas siempre al final, sin alterar el orden relativo
function sortActions(actions: RowAction[]) {
  return {
    regular: actions.filter((action) => !action.destructive),
    destructive: actions.filter((action) => action.destructive)
  }
}

/**
 * Acciones de una fila de tabla. En escritorio (>= 768 px) un solo botón de
 * tres puntos abre un menú. En móvil (< 768 px) los mismos items quedan como
 * botones en línea de 44 px: la fila ya se desliza y un menú de dos toques
 * cuesta más en pantalla táctil. Se pintan ambos y el corte lo hace CSS, así
 * no hay desajuste de hidratación. La misma lista sirve a RowContextMenu
 * (clic derecho y pulsación larga)
 */
export function RowActions({ label, actions }: RowActionsProps) {
  const { regular, destructive } = sortActions(actions)
  const ariaLabel = `Acciones de ${label}`

  return (
    <>
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex items-center justify-end gap-1 md:hidden"
        data-tour="row-actions"
      >
        {[...regular, ...destructive].map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            size="icon"
            aria-label={`${action.label}: ${label}`}
            disabled={action.isDisabled}
            onClick={action.onAction}
            className={cn(action.destructive && "text-destructive")}
          >
            {action.icon}
          </Button>
        ))}
      </div>

      {/* Ancla compartida: el tutorial resalta la primera fila visible */}
      <div
        className="hidden justify-end md:flex"
        data-tour="row-actions"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={ariaLabel}
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-auto min-w-48"
          >
            {regular.map((action) => (
              <DropdownMenuItem
                key={action.id}
                disabled={action.isDisabled}
                onClick={action.onAction}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
            {regular.length > 0 && destructive.length > 0 && (
              <DropdownMenuSeparator />
            )}
            {destructive.map((action) => (
              <DropdownMenuItem
                key={action.id}
                variant="destructive"
                disabled={action.isDisabled}
                onClick={action.onAction}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

interface RowContextMenuProps extends RowActionsProps {
  /**
   * La fila: un único elemento (`<tr>`, `<li>`, `<div>`). Recibe el
   * comportamiento del menú contextual sin envolverse en otra caja, así una
   * `<tr>` sigue siendo hija directa de `<tbody>`
   */
  children: ReactElement
}

/**
 * Menú contextual de una fila: clic derecho en escritorio y pulsación larga
 * (500 ms) en táctil, con las mismas acciones y el mismo orden que el botón
 * ⋯ de RowActions. Cada lista o tabla envuelve sus filas en él (SPEC 52 y
 * 53); el botón ⋯ sigue siendo la vía visible y de teclado
 */
export function RowContextMenu({
  label,
  actions,
  children
}: RowContextMenuProps) {
  const { regular, destructive } = sortActions(actions)

  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="w-auto min-w-48">
        <ContextMenuGroup>
          <ContextMenuLabel className="truncate first-letter:uppercase">
            {label}
          </ContextMenuLabel>
          {regular.map((action) => (
            <ContextMenuItem
              key={action.id}
              disabled={action.isDisabled}
              onClick={action.onAction}
            >
              {action.icon}
              {action.label}
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
        {regular.length > 0 && destructive.length > 0 && (
          <ContextMenuSeparator />
        )}
        {destructive.map((action) => (
          <ContextMenuItem
            key={action.id}
            variant="destructive"
            disabled={action.isDisabled}
            onClick={action.onAction}
          >
            {action.icon}
            {action.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Corta el menú contextual de la fila para lo que vive dentro de ella pero
 * se pinta en un portal (diálogos de editar, ajustar…): los eventos de React
 * suben por el portal hasta la fila, y un clic derecho o una pulsación larga
 * dentro del diálogo abriría el menú de la fila. No agrega caja (`contents`)
 */
export function RowMenuBoundary({ children }: { children: ReactNode }) {
  return (
    <div
      className="contents"
      onContextMenu={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  )
}
