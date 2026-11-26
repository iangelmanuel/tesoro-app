"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useCommandPalette, useModKey } from "./command-palette-context"
import { preloadCommandPalette } from "./command-palette-lazy"

/**
 * Disparador visible de la paleta en el header, con su atajo. En el teléfono
 * la paleta se abre desde la hoja de acciones rápidas
 */
export function CommandTrigger() {
  const { setOpen } = useCommandPalette()
  const mod = useModKey()

  return (
    <Button
      variant="secondary"
      className="hidden w-56 justify-start gap-2 px-4 font-medium text-muted-foreground hover:text-foreground md:inline-flex lg:w-72"
      aria-keyshortcuts="Control+K Meta+K"
      data-tour="header-search"
      onClick={() => setOpen(true)}
      onPointerEnter={preloadCommandPalette}
      onFocus={preloadCommandPalette}
    >
      <Search className="size-4" />
      <span className="truncate">Buscar o ejecutar</span>
      <Kbd className="ml-auto">{mod} K</Kbd>
    </Button>
  )
}
