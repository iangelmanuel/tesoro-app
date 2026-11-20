"use client"

import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/libs/cn"
import { useModKey } from "../command/command-palette-context"

/**
 * Teclas de un atajo como <Kbd>: "mod" se vuelve ⌘ o Ctrl según el sistema.
 * `then` separa una secuencia (G luego M) en vez de una combinación
 */
export function ShortcutKeys({
  keys,
  sequence = false,
  className
}: {
  keys: readonly string[]
  /** Teclas una tras otra (G, M) en vez de a la vez (Ctrl+K) */
  sequence?: boolean
  className?: string
}) {
  const mod = useModKey()

  return (
    <span className={cn("ml-auto flex items-center gap-1", className)}>
      {keys.map((key, index) => (
        <span
          key={`${key}-${index}`}
          className="flex items-center gap-1"
        >
          {index > 0 && sequence && (
            <span className="text-xs text-muted-foreground">luego</span>
          )}
          <Kbd>{key === "mod" ? mod : key.toUpperCase()}</Kbd>
        </span>
      ))}
    </span>
  )
}
