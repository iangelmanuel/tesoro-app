"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { type TutorialSection, getTutorialSection } from "@/config/tutorials"
import { useTutorial } from "../use-tutorial"
import { useTutorialProgress } from "./tutorial-provider"

// Después de la hoja de acciones rápidas, que se autoabre a los 400 ms en
// móvil (SPEC 15): si se abre, el tutorial espera a que se cierre
const START_DELAY_MS = 600
// Espera tras el último cambio del DOM antes de volver a comprobar
const SETTLE_MS = 150
// Tope para esperar a que la página termine de cargar (esqueletos)
const MAX_LOADING_WAIT_MS = 8000

// El popover de driver.js también es role="dialog": no cuenta como bloqueo
const BLOCKING_OVERLAY =
  '[role="dialog"]:not(#driver-popover-content), [role="alertdialog"]'

function hasBlockingOverlay() {
  return document.querySelector(BLOCKING_OVERLAY) !== null
}

// Los Suspense de la página muestran esqueletos de HeroUI mientras cargan;
// arrancar antes dejaría fuera los pasos de lo que aún no está en pantalla
function isContentLoading() {
  return document.querySelector("#contenido .skeleton") !== null
}

/**
 * Arranca solo el tutorial de la sección actual mientras no esté completado
 * (SPEC 27). Va en el layout del dashboard; fuera de las 9 secciones de
 * Personal no hace nada.
 */
export function TutorialAutoStart() {
  const pathname = usePathname()
  const section = getTutorialSection(pathname)

  if (!section) {
    return null
  }

  // Una instancia por sección: volver a una sección pendiente lo rearranca
  return (
    <SectionAutoStart
      key={section}
      section={section}
    />
  )
}

function SectionAutoStart({ section }: Readonly<{ section: TutorialSection }>) {
  const { completed, start } = useTutorial(section)
  const { pendingStart, clearPendingStart } = useTutorialProgress()
  const started = useRef(false)
  // "Ver de nuevo" (Cuenta › Preferencias) arranca aunque esté completado
  const forced = pendingStart === section

  useEffect(() => {
    if ((completed && !forced) || started.current) {
      return
    }

    const mountedAt = performance.now()
    let timer: number | undefined
    let cancelled = false

    function tryStart() {
      if (cancelled || started.current) {
        return
      }

      const elapsed = performance.now() - mountedAt

      // Sin bloquear la carga; un overlay abierto se reintenta al cerrarse
      // (el observer vuelve a llamar)
      if (
        elapsed < START_DELAY_MS ||
        hasBlockingOverlay() ||
        (isContentLoading() && elapsed < MAX_LOADING_WAIT_MS)
      ) {
        return
      }

      started.current = true
      observer.disconnect()
      if (forced) {
        clearPendingStart()
      }
      start().catch(() => {
        // driver.js no se pudo descargar: se intenta en la próxima visita
        started.current = false
      })
    }

    function schedule(delay = SETTLE_MS) {
      window.clearTimeout(timer)
      timer = window.setTimeout(tryStart, delay)
    }

    const observer = new MutationObserver(() => schedule())
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role"]
    })

    schedule(START_DELAY_MS)
    const fallback = window.setTimeout(tryStart, MAX_LOADING_WAIT_MS)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearTimeout(timer)
      window.clearTimeout(fallback)
    }
  }, [completed, forced, start, clearPendingStart])

  return null
}
