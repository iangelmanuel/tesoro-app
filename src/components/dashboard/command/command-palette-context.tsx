"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react"

interface CommandPaletteValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const CommandPaletteContext = createContext<CommandPaletteValue | null>(null)

/**
 * Estado de la paleta de comandos (SPEC 51 §5): la abren ⌘K / Ctrl+K, el
 * disparador del header y la hoja de acciones del teléfono. ⌘K / Ctrl+K
 * funciona en todo el dashboard, aunque los atajos de una tecla estén
 * apagados, y también dentro de un campo de texto (no escribe nada)
 */
export function CommandPaletteProvider({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext)

  if (!context) {
    throw new Error(
      "useCommandPalette debe usarse dentro de <CommandPaletteProvider />"
    )
  }

  return context
}

const subscribe = () => () => {}

/**
 * Tecla modificadora del sistema: "⌘" en macOS e iOS, "Ctrl" en el resto. En
 * el servidor (y en la primera hidratación) es "Ctrl"
 */
export function useModKey() {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl"
  )
}
