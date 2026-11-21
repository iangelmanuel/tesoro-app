"use client"

import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { HELP, HELP_LABELS, type HelpKey } from "@/config/help"
import { cn } from "@/libs/cn"

/**
 * Ícono (i) junto a un concepto con su explicación corta. Es un Popover y no
 * un Tooltip: se abre con clic, toque o teclado, no solo al pasar el mouse.
 * Se dibuja de 24 px y su área táctil llega a 44 px (touch-hitbox)
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
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Qué es ${HELP_LABELS[topic]}`}
            className={cn(
              "size-6 text-muted-foreground hover:text-foreground",
              className
            )}
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-auto max-w-72 gap-0 p-3 text-sm leading-relaxed"
      >
        {HELP[topic]}
      </PopoverContent>
    </Popover>
  )
}
