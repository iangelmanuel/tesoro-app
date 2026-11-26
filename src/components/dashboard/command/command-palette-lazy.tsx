"use client"

import { Suspense, lazy, useState } from "react"
import type { CommandPalette as Palette } from "./command-palette"
import { useCommandPalette } from "./command-palette-context"

type PaletteModule = { default: typeof Palette }

let palettePromise: Promise<PaletteModule> | undefined

// Una sola descarga: la comparten la precarga y el primer render. Si falla
// (red caída), se olvida para que el siguiente intento la pida de nuevo
function loadPalette() {
  palettePromise ??= import("./command-palette")
    .then((m) => ({ default: m.CommandPalette }))
    .catch((error: unknown) => {
      palettePromise = undefined
      throw error
    })
  return palettePromise
}

const CommandPalette = lazy(loadPalette)

/**
 * Precarga el diálogo de la paleta (cmdk). Va en `onPointerEnter` y
 * `onFocus` de sus disparadores, así el clic no espera la descarga
 */
export function preloadCommandPalette() {
  loadPalette().catch(() => {})
}

/**
 * Paleta de comandos diferida (SPEC 56b): ⌘K / Ctrl+K se registra desde el
 * inicio en CommandPaletteProvider y el diálogo se descarga la primera vez
 * que se abre (o al precargarlo). Después queda montado para que el cierre
 * anime igual que antes
 */
export function CommandPaletteLazy() {
  const { open } = useCommandPalette()
  const [mounted, setMounted] = useState(false)

  if (open && !mounted) {
    setMounted(true)
  }

  if (!mounted) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  )
}
