// Motor de los tutoriales (SPEC 27). Este módulo solo se carga con import()
// al arrancar un tutorial: driver.js y su CSS no entran en el bundle inicial
// del dashboard.
import { type DriveStep, type Driver, driver } from "driver.js"
import type { TutorialStep } from "@/config/tutorials"
import { MOBILE_QUERY } from "@/hooks/use-is-mobile"
import "./tour-theme.css"
import "driver.js/dist/driver.css"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

// El primario del espacio (emerald en Personal) se define en el contenedor
// del dashboard, no en <html>; driver.js monta el popover en <body>
const WORKSPACE_TOKENS = ["--accent", "--accent-foreground", "--focus"]

/** Copia el primario del espacio actual al popover */
function applyWorkspaceTokens(popover: HTMLElement) {
  const content = document.getElementById("contenido")

  if (!content) {
    return
  }

  const styles = getComputedStyle(content)

  for (const token of WORKSPACE_TOKENS) {
    const value = styles.getPropertyValue(token).trim()

    if (value) {
      popover.style.setProperty(token, value)
    }
  }
}

let activeTour: Driver | null = null

/**
 * Primer elemento visible con ese `data-tour`. Escritorio y móvil pueden
 * tener el mismo ancla en componentes distintos; el oculto (`display: none`)
 * no cuenta.
 */
function findVisibleTarget(target: string): Element | undefined {
  const candidates = document.querySelectorAll(
    `[data-tour="${CSS.escape(target)}"]`
  )

  return Array.from(candidates).find(
    (element) => element.getClientRects().length > 0
  )
}

/**
 * Pasos que aplican ahora: los del viewport actual y, si apuntan a un
 * elemento, solo cuando ese elemento está en pantalla. Un paso sin elemento
 * se omite y el recorrido sigue.
 */
function resolveSteps(steps: readonly TutorialStep[]): DriveStep[] {
  const viewport = window.matchMedia(MOBILE_QUERY).matches
    ? "mobile"
    : "desktop"

  return steps.flatMap((step) => {
    if (step.viewport && step.viewport !== viewport) {
      return []
    }

    const popover = { title: step.title, description: step.description }

    if (!step.target) {
      return [{ popover }]
    }

    const element = findVisibleTarget(step.target)
    return element ? [{ element, popover }] : []
  })
}

export function isTourActive() {
  return activeTour?.isActive() ?? false
}

/** Cierra el recorrido activo sin completarlo (p. ej., al salir de la sección) */
export function destroyTour() {
  activeTour?.destroy()
  activeTour = null
}

/**
 * Arranca el recorrido. `onDone` solo se llama al pulsar **Terminar** en el
 * último paso; cerrar a medias (X, Escape o clic fuera) no completa.
 * Devuelve false si no hay pasos que mostrar.
 */
export function runTour({
  steps,
  onDone
}: {
  steps: readonly TutorialStep[]
  onDone: () => void
}): boolean {
  activeTour?.destroy()
  activeTour = null

  const driveSteps = resolveSteps(steps)

  if (driveSteps.length === 0) {
    return false
  }

  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches

  const tour = driver({
    steps: driveSteps,
    animate: !reducedMotion,
    smoothScroll: !reducedMotion,
    allowClose: true,
    allowKeyboardControl: true,
    overlayClickBehavior: "close",
    showProgress: true,
    progressText: "Paso {{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Terminar",
    closeBtnLabel: "Cerrar tutorial",
    showButtons: ["next", "previous", "close"],
    popoverClass: "tesoro-tour",
    stagePadding: 6,
    stageRadius: 16,
    overlayColor: "black",
    overlayOpacity: 0.6,
    onPopoverRender: (popover) => applyWorkspaceTokens(popover.wrapper),
    onDestroyed: (_element, _step, { reason }) => {
      if (activeTour === tour) {
        activeTour = null
      }

      if (reason === "done") {
        onDone()
      }
    }
  })

  activeTour = tour
  tour.drive()
  return true
}
