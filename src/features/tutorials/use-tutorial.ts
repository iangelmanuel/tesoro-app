"use client"

import { useCallback, useEffect, useRef } from "react"
import { TUTORIALS, type TutorialSection } from "@/config/tutorials"
import { useTutorialProgress } from "./components/tutorial-provider"

type TourEngine = typeof import("./engine/run-tour")

// Una sola descarga de driver.js por sesión, compartida por todas las secciones
let enginePromise: Promise<TourEngine> | null = null

function loadEngine() {
  enginePromise ??= import("./engine/run-tour").catch((error: unknown) => {
    enginePromise = null
    throw error
  })
  return enginePromise
}

/**
 * Tutorial guiado de una sección de Personal (SPEC 27). `start()` descarga
 * driver.js la primera vez, filtra los pasos por viewport y por elementos en
 * pantalla, y marca el tutorial como completado solo al pulsar **Terminar**.
 * Al desmontar la sección, el recorrido abierto se cierra sin completarse.
 */
export function useTutorial(section: TutorialSection) {
  const { isCompleted, markCompleted } = useTutorialProgress()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      enginePromise?.then((engine) => engine.destroyTour()).catch(() => {})
    }
  }, [section])

  const start = useCallback(async (): Promise<boolean> => {
    const engine = await loadEngine()

    // Pudo cambiar de sección mientras se descargaba
    if (!mounted.current) {
      return false
    }

    return engine.runTour({
      steps: TUTORIALS[section],
      onDone: () => markCompleted(section)
    })
  }, [section, markCompleted])

  return {
    completed: isCompleted(section),
    start
  }
}
