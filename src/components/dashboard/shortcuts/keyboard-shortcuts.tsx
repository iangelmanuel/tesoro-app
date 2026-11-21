"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { GO_SEQUENCE_TIMEOUT_MS, SHORTCUTS } from "@/config/shortcuts"
import { useQuickActions } from "../quick-actions-context"
import { getNavTargets } from "./nav-targets"
import { ShortcutKeys } from "./shortcut-keys"
import { useShortcutsPreference } from "./shortcuts-preference"

// Los atajos no se disparan escribiendo en un campo
function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable]") !== null
  )
}

// Ni con un diálogo, panel o menú abierto
function hasOpenOverlay() {
  return (
    document.querySelector(
      "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]"
    ) !== null
  )
}

/**
 * Atajos de una tecla del dashboard (SPEC 51 §5): N nuevo movimiento,
 * T traspaso, ? esta hoja y G + letra para ir a una pantalla (máx. 1 s entre
 * teclas). Se apagan en Cuenta → Preferencias; ⌘K / Ctrl+K va aparte
 * (CommandPaletteProvider) y sigue activo
 */
export function KeyboardShortcuts() {
  const router = useRouter()
  const { enabled } = useShortcutsPreference()
  const { workspace, run } = useQuickActions()
  const [helpOpen, setHelpOpen] = useState(false)
  const goPressedAt = useRef<number | null>(null)
  const targets = useMemo(() => getNavTargets(workspace), [workspace])

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.repeat || isEditable(event.target) || hasOpenOverlay()) return

      const key = event.key.toLowerCase()
      const goAt = goPressedAt.current
      goPressedAt.current = null

      // Segunda tecla de "G + letra"
      if (goAt !== null && Date.now() - goAt <= GO_SEQUENCE_TIMEOUT_MS) {
        const target = targets.find(
          (item) => item.shortcut?.toLowerCase() === key
        )
        if (target) {
          event.preventDefault()
          router.push(target.href as Route)
        }
        return
      }

      if (key === SHORTCUTS.goPrefix) {
        goPressedAt.current = Date.now()
        return
      }
      if (event.key === "?") {
        event.preventDefault()
        setHelpOpen(true)
        return
      }
      // Registrar solo existe dentro de un espacio
      if (!workspace) return
      if (key === SHORTCUTS.newTransaction.keys[0]) {
        event.preventDefault()
        run("movement")
      } else if (key === SHORTCUTS.newTransfer.keys[0]) {
        event.preventDefault()
        run("transfer")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, router, run, targets, workspace])

  return (
    <ShortcutsHelp
      open={helpOpen && enabled}
      onOpenChange={setHelpOpen}
    />
  )
}

/**
 * Hoja de atajos (tecla ?): todos los de SHORTCUTS y los G + letra del
 * espacio activo
 */
function ShortcutsHelp({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { workspace } = useQuickActions()
  const targets = getNavTargets(workspace).filter((item) => item.shortcut)
  const general = [
    SHORTCUTS.commandPalette,
    SHORTCUTS.newTransaction,
    SHORTCUTS.newTransfer,
    SHORTCUTS.help
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            No funcionan mientras escribes en un campo ni con una ventana
            abierta. Puedes apagarlos en Cuenta → Preferencias.
          </DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Generales
          </h3>
          <dl className="flex flex-col">
            {general.map((shortcut) => (
              <div
                key={shortcut.label}
                className="flex min-h-11 items-center gap-3 border-b border-border/60 last:border-b-0"
              >
                <dt className="text-sm">{shortcut.label}</dt>
                <dd className="ml-auto">
                  <ShortcutKeys keys={shortcut.keys} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Ir a{workspace?.type === "business" ? " (Empresa)" : " (Personal)"}
          </h3>
          <dl className="flex flex-col">
            {targets.map((target) => (
              <div
                key={target.href}
                className="flex min-h-11 items-center gap-3 border-b border-border/60 last:border-b-0"
              >
                <dt className="text-sm">{target.name}</dt>
                <dd className="ml-auto">
                  <ShortcutKeys
                    keys={[SHORTCUTS.goPrefix, target.shortcut ?? ""]}
                    sequence
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </DialogContent>
    </Dialog>
  )
}
