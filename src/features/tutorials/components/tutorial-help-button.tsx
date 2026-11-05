"use client"

import { usePathname } from "next/navigation"
import { Button, toast } from "@heroui/react"
import { CircleHelp } from "lucide-react"
import { type TutorialSection, getTutorialSection } from "@/config/tutorials"
import { useTutorial } from "../use-tutorial"

/**
 * Botón `?` del header (SPEC 27): repite el tutorial de la sección actual
 * aunque ya esté completado. Solo aparece en las 9 secciones de Personal.
 */
export function TutorialHelpButton() {
  const pathname = usePathname()
  const section = getTutorialSection(pathname)

  if (!section) {
    return null
  }

  return (
    <HelpButton
      key={section}
      section={section}
    />
  )
}

function HelpButton({ section }: Readonly<{ section: TutorialSection }>) {
  const { start } = useTutorial(section)

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label="Ver tutorial de esta sección"
      className="max-md:size-11"
      onPress={() => {
        start().catch(() => {
          toast.danger("No se pudo abrir el tutorial. Intenta de nuevo")
        })
      }}
    >
      <CircleHelp className="size-4" />
    </Button>
  )
}
