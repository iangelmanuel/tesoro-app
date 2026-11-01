"use client"

import { Button, Popover, cn } from "@heroui/react"
import { Info } from "lucide-react"
import { HELP, HELP_LABELS, type HelpKey } from "@/config/help"

/**
 * Ícono (i) junto a un concepto con su explicación corta. Es un Popover y no
 * un Tooltip: se abre con clic, toque o teclado, no solo al pasar el mouse
 */
export function HelpHint({
  topic,
  className
}: {
  topic: HelpKey
  className?: string
}) {
  return (
    <Popover>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={`Qué es ${HELP_LABELS[topic]}`}
        className={cn(
          "size-6 min-w-6 text-muted hover:text-foreground",
          className
        )}
      >
        <Info className="size-3.5" />
      </Button>
      <Popover.Content
        placement="top"
        className="max-w-72"
      >
        <Popover.Dialog className="p-3 text-sm leading-relaxed">
          {HELP[topic]}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
