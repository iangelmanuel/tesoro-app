"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MOBILE_QUERY } from "@/hooks/use-is-mobile"

const AUTO_OPEN_KEY = "tesoro:quick-sheet:auto-open:v1"
const HIDDEN_AT_KEY = "tesoro:quick-sheet:hidden-at:v1"
const HIDDEN_THRESHOLD_MS = 5 * 60 * 1000
const INITIAL_OPEN_DELAY_MS = 400

// Si el almacenamiento falla (modo privado, bloqueado) se usan estos valores
// en memoria y la hoja se comporta como si el switch estuviera encendido
let memoryAutoOpen = true
let memoryHiddenAt: number | null = null

function readAutoOpen() {
  try {
    const value = window.localStorage.getItem(AUTO_OPEN_KEY)
    if (value === "true" || value === "false") return value === "true"
  } catch {
    // Almacenamiento no disponible
  }
  return memoryAutoOpen
}

function writeAutoOpen(value: boolean) {
  memoryAutoOpen = value
  try {
    window.localStorage.setItem(AUTO_OPEN_KEY, String(value))
  } catch {
    // Se queda en memoria
  }
}

function readHiddenAt() {
  try {
    const value = window.sessionStorage.getItem(HIDDEN_AT_KEY)
    if (value !== null && Number.isFinite(Number(value))) return Number(value)
  } catch {
    // Almacenamiento no disponible
  }
  return memoryHiddenAt
}

function writeHiddenAt(value: number | null) {
  memoryHiddenAt = value
  try {
    if (value === null) window.sessionStorage.removeItem(HIDDEN_AT_KEY)
    else window.sessionStorage.setItem(HIDDEN_AT_KEY, String(value))
  } catch {
    // Se queda en memoria
  }
}

// Un diálogo (o el Drawer del aside) abierto bloquea la apertura automática:
// solo hay un overlay a la vez
function hasOpenDialog() {
  return (
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  )
}

interface UseQuickSheetAutoOpenOptions {
  /** La ruta actual es de un espacio (Personal o una empresa) */
  enabled: boolean
}

/**
 * Estado de la hoja de acciones rápidas y su apertura automática en móvil:
 * - se abre en la carga completa de una ruta de espacio (entrar, recargar,
 *   reabrir la app instalada);
 * - se abre al volver visible la pestaña tras 5 minutos o más oculta;
 * - la navegación entre páginas no la abre;
 * - no se abre con el switch apagado, con un diálogo abierto, fuera de un
 *   espacio ni en `>= 768 px`.
 */
export function useQuickSheetAutoOpen({
  enabled
}: UseQuickSheetAutoOpenOptions) {
  const [open, setOpen] = useState(false)
  const [autoOpen, setAutoOpenState] = useState(true)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const canOpen = useCallback(
    () =>
      enabledRef.current &&
      window.matchMedia(MOBILE_QUERY).matches &&
      readAutoOpen() &&
      !hasOpenDialog(),
    []
  )

  // Solo al montar el shell: una carga completa. Navegar entre páginas no lo
  // vuelve a ejecutar porque el layout del dashboard se conserva.
  // La apertura espera a que terminen de hidratar los Suspense de la página:
  // al abrir el overlay, React Aria marca como `inert` el resto del DOM y un
  // bloque aún sin hidratar vería ese atributo y fallaría la hidratación
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la preferencia vive en localStorage: solo se puede leer en el cliente
    setAutoOpenState(readAutoOpen())
    const timer = window.setTimeout(() => {
      if (canOpen()) setOpen(true)
    }, INITIAL_OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [canOpen])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        writeHiddenAt(Date.now())
        return
      }

      const hiddenAt = readHiddenAt()
      writeHiddenAt(null)
      if (
        hiddenAt !== null &&
        Date.now() - hiddenAt >= HIDDEN_THRESHOLD_MS &&
        canOpen()
      ) {
        setOpen(true)
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [canOpen])

  const setAutoOpen = useCallback((value: boolean) => {
    writeAutoOpen(value)
    setAutoOpenState(value)
  }, [])

  return { open, setOpen, autoOpen, setAutoOpen }
}
