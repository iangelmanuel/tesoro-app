"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useState,
  useTransition
} from "react"
import { toast } from "@heroui/react"
import type { TutorialSection } from "@/config/tutorials"
import { completeTutorialAction, resetTutorialsAction } from "../actions"

interface TutorialValue {
  /** Secciones cuyo tutorial ya terminó el usuario */
  completed: ReadonlySet<TutorialSection>
  isCompleted: (section: TutorialSection) => boolean
  /** Marca al instante y guarda en `tutorial_progress` */
  markCompleted: (section: TutorialSection) => void
  /** Borra todo el progreso: los tutoriales vuelven a arrancar solos */
  reset: () => void
  /** Hay un reinicio en curso */
  isResetting: boolean
  /**
   * Sección cuyo tutorial debe arrancar al entrar aunque esté completado
   * ("Ver de nuevo" en Cuenta › Preferencias)
   */
  pendingStart: TutorialSection | null
  requestStart: (section: TutorialSection) => void
  clearPendingStart: () => void
}

const TutorialContext = createContext<TutorialValue | null>(null)

// `initial` viene del servidor (layout del dashboard): el arranque automático
// decide sin parpadeo ni consulta extra por página. El estado optimista da
// respuesta inmediata; si guardar falla, vuelve atrás. El provider vive en el
// layout, así que `pendingStart` sobrevive a la navegación entre páginas.
export function TutorialProvider({
  initial,
  children
}: Readonly<{
  initial: readonly TutorialSection[]
  children: React.ReactNode
}>) {
  const base = useMemo<ReadonlySet<TutorialSection>>(
    () => new Set(initial),
    [initial]
  )
  const [completed, setOptimistic] = useOptimistic(base)
  const [, startTransition] = useTransition()
  const [isResetting, startReset] = useTransition()
  const [pendingStart, setPendingStart] = useState<TutorialSection | null>(null)
  // Estable: el arranque automático la usa como dependencia de su efecto
  const clearPendingStart = useCallback(() => setPendingStart(null), [])

  const value = useMemo<TutorialValue>(
    () => ({
      completed,
      isCompleted: (section) => completed.has(section),
      markCompleted: (section) => {
        if (completed.has(section)) {
          return
        }

        startTransition(async () => {
          setOptimistic(new Set([...completed, section]))
          const { error } = await completeTutorialAction(section)

          if (error) {
            toast.danger(error)
          }
        })
      },
      reset: () => {
        startReset(async () => {
          setOptimistic(new Set())
          const { error } = await resetTutorialsAction()

          if (error) {
            toast.danger(error)
          } else {
            toast.success("Los tutoriales volverán a arrancar solos")
          }
        })
      },
      isResetting,
      pendingStart,
      requestStart: setPendingStart,
      clearPendingStart
    }),
    [completed, setOptimistic, isResetting, pendingStart, clearPendingStart]
  )

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorialProgress() {
  const context = useContext(TutorialContext)

  if (!context) {
    throw new Error(
      "useTutorialProgress debe usarse dentro de <TutorialProvider />"
    )
  }

  return context
}
