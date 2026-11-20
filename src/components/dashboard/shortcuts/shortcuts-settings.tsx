"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useShortcutsPreference } from "./shortcuts-preference"

/**
 * Switch "Atajos de teclado" de Cuenta → Preferencias. Apaga N, T, ? y
 * G + letra en este navegador (WCAG 2.1.4); ⌘K / Ctrl+K sigue activo
 */
export function ShortcutsSettings() {
  const { enabled, setEnabled } = useShortcutsPreference()
  const descriptionId = useId()

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${descriptionId}-switch`}>Atajos de teclado</Label>
        <p
          id={descriptionId}
          className="text-sm text-muted-foreground"
        >
          N, T, ? y G + letra. Se guarda en este navegador. Ctrl+K sigue
          abriendo la búsqueda.
        </p>
      </div>
      <Switch
        id={`${descriptionId}-switch`}
        aria-describedby={descriptionId}
        checked={enabled}
        onCheckedChange={setEnabled}
      />
    </div>
  )
}
