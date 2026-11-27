"use client"

import { useActiveWorkspace } from "../shell/use-active-workspace"
import { mountsOn } from "../shell/viewport"
import { useViewport } from "../shell/viewport-context"
import { BottomNav } from "./bottom-nav"
import { QuickSheet } from "./quick-sheet"
import { useQuickSheetAutoOpen } from "./use-quick-sheet-auto-open"

// Hoja de acciones rápidas y barra inferior del teléfono. Comparten el estado
// de apertura: el botón [+] de la barra y la apertura automática abren la
// misma hoja. En escritorio no se montan (SPEC 57); el estado y la apertura
// automática viven aquí, fuera de la condición, así pasar de escritorio a
// teléfono no abre la hoja como si fuera una carga nueva
export function MobileShell() {
  const workspace = useActiveWorkspace()
  const viewport = useViewport()
  const { open, setOpen, autoOpen, setAutoOpen } = useQuickSheetAutoOpen({
    enabled: workspace !== undefined
  })

  if (!mountsOn(viewport, "mobile")) {
    return null
  }

  return (
    <>
      <QuickSheet
        open={open}
        onOpenChange={setOpen}
        autoOpen={autoOpen}
        onAutoOpenChange={setAutoOpen}
      />
      <BottomNav onOpenQuickSheet={() => setOpen(true)} />
    </>
  )
}
