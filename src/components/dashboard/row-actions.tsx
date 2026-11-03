"use client"

import type { ReactNode } from "react"
import { Button, Dropdown, Label } from "@heroui/react"
import { EllipsisVertical } from "lucide-react"

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
  return [
    ...actions.filter((action) => !action.destructive),
    ...actions.filter((action) => action.destructive)
  ]
}

/**
 * Acciones de una fila de tabla. En escritorio (>= 768 px) un solo botón de
 * tres puntos abre un menú. En móvil (< 768 px) los mismos items quedan como
 * botones en línea de 44 px: la fila ya se desliza y un menú de dos toques
 * cuesta más en pantalla táctil. Se pintan ambos y el corte lo hace CSS, así
 * no hay desajuste de hidratación.
 */
export function RowActions({ label, actions }: RowActionsProps) {
  const items = sortActions(actions)
  const ariaLabel = `Acciones de ${label}`

  return (
    <>
      <div
        role="group"
        aria-label={ariaLabel}
        className="flex items-center justify-end gap-1 md:hidden"
      >
        {items.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            isIconOnly
            aria-label={`${action.label}: ${label}`}
            isDisabled={action.isDisabled}
            onPress={action.onAction}
            className={`size-11 min-w-11 ${action.destructive ? "text-danger" : ""}`}
          >
            <span className={action.destructive ? "text-danger" : undefined}>
              {action.icon}
            </span>
          </Button>
        ))}
      </div>

      <div className="hidden justify-end md:flex">
        <Dropdown>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            className="pointer-coarse:size-11"
            aria-label={ariaLabel}
          >
            <EllipsisVertical />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label={ariaLabel}
              onAction={(key) =>
                items.find((action) => action.id === key)?.onAction()
              }
            >
              {items.map((action) => (
                <Dropdown.Item
                  key={action.id}
                  id={action.id}
                  textValue={action.label}
                  variant={action.destructive ? "danger" : "default"}
                  isDisabled={action.isDisabled}
                >
                  <span
                    className={action.destructive ? "text-danger" : undefined}
                  >
                    {action.icon}
                  </span>
                  <Label>{action.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </>
  )
}
