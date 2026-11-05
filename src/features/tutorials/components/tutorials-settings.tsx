"use client"

import { useRouter } from "next/navigation"
import { Button, Chip } from "@heroui/react"
import { RotateCcw } from "lucide-react"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { TUTORIAL_SECTIONS, TUTORIAL_SECTION_INFO } from "@/config/tutorials"
import { useTutorialProgress } from "./tutorial-provider"

/**
 * Tarjeta Tutoriales de Cuenta › Preferencias (SPEC 27): estado de cada
 * sección, "Ver de nuevo" y "Reiniciar todos".
 */
export function TutorialsSettings() {
  const router = useRouter()
  const { isCompleted, completed, reset, isResetting, requestStart } =
    useTutorialProgress()

  return (
    <div className="flex flex-col gap-4">
      <ul className={CARD_LIST}>
        {TUTORIAL_SECTIONS.map((section) => {
          const { label, href } = TUTORIAL_SECTION_INFO[section]
          const done = isCompleted(section)

          return (
            <li
              key={section}
              className={`flex flex-wrap items-center gap-3 ${CARD_ROW}`}
            >
              <span className="min-w-0 flex-1 font-medium">{label}</span>
              <Chip
                size="sm"
                className={
                  done ? TONE_BADGE_CLASSES.success : TONE_BADGE_CLASSES.neutral
                }
              >
                {done ? "Completado" : "Pendiente"}
              </Chip>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Ver de nuevo el tutorial de ${label}`}
                className="max-md:min-h-11"
                onPress={() => {
                  // El arranque automático de la sección lo toma al entrar
                  requestStart(section)
                  router.push(href)
                }}
              >
                Ver de nuevo
              </Button>
            </li>
          )
        })}
      </ul>
      <div>
        <Button
          variant="secondary"
          className="max-md:min-h-11"
          isDisabled={isResetting || completed.size === 0}
          onPress={reset}
        >
          <RotateCcw />
          Reiniciar todos
        </Button>
      </div>
    </div>
  )
}
