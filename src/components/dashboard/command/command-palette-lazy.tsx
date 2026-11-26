"use client"

import { Suspense, useState } from "react"
import { lazyWithPreload } from "@/libs/lazy-with-preload"
import { useCommandPalette } from "./command-palette-context"

const Palette = lazyWithPreload(() =>
  import("./command-palette").then((m) => m.CommandPalette)
)

/**
 * Precarga el diálogo de la paleta (cmdk). Va en `onPointerEnter` y
 * `onFocus` de sus disparadores, así el clic no espera la descarga
 */
export const preloadCommandPalette = Palette.preload

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
      <Palette.Component />
    </Suspense>
  )
}
