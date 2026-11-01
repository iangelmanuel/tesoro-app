"use client"

import { useActiveWorkspace } from "../use-active-workspace"
import { BottomNav } from "./bottom-nav"
import { QuickSheet } from "./quick-sheet"
import { useQuickSheetAutoOpen } from "./use-quick-sheet-auto-open"

// Hoja de acciones rápidas y barra inferior del teléfono. Comparten el estado
// de apertura: el botón [+] de la barra y la apertura automática abren la
// misma hoja
export function MobileShell() {
  const workspace = useActiveWorkspace()
  const { open, setOpen, autoOpen, setAutoOpen } = useQuickSheetAutoOpen({
    enabled: workspace !== undefined
  })

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
