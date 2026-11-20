"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { SHORTCUTS_COOKIE } from "@/config/shortcuts"

interface ShortcutsPreference {
  /** Atajos de una tecla y G + letra. ⌘K / Ctrl+K no depende de esto */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

const ShortcutsPreferenceContext = createContext<ShortcutsPreference | null>(
  null
)

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Si los atajos de teclado están encendidos. Se guarda por navegador en la
 * cookie `tesoro-shortcuts`, que el layout lee en el servidor para que el
 * primer render ya respete la preferencia (como el ancho del aside)
 */
export function ShortcutsPreferenceProvider({
  initial,
  children
}: Readonly<{ initial: boolean; children: React.ReactNode }>) {
  const [enabled, setEnabledState] = useState(initial)

  const value = useMemo<ShortcutsPreference>(
    () => ({
      enabled,
      setEnabled: (next) => {
        setEnabledState(next)
        document.cookie = `${SHORTCUTS_COOKIE}=${next ? "on" : "off"}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
      }
    }),
    [enabled]
  )

  return (
    <ShortcutsPreferenceContext.Provider value={value}>
      {children}
    </ShortcutsPreferenceContext.Provider>
  )
}

export function useShortcutsPreference() {
  const context = useContext(ShortcutsPreferenceContext)

  if (!context) {
    throw new Error(
      "useShortcutsPreference debe usarse dentro de <ShortcutsPreferenceProvider />"
    )
  }

  return context
}
