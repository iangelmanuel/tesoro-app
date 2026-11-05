import { cache } from "react"
import { TUTORIAL_SECTIONS, type TutorialSection } from "@/config/tutorials"
import { createClient } from "@/libs/supabase/server"

function isTutorialSection(value: string): value is TutorialSection {
  return (TUTORIAL_SECTIONS as readonly string[]).includes(value)
}

/**
 * Secciones cuyo tutorial completó el usuario autenticado. Sin fila = pendiente.
 * Se deduplica por request con `cache`.
 */
export const getCompletedTutorials = cache(
  async (): Promise<TutorialSection[]> => {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return []
    }

    const { data, error } = await supabase
      .from("tutorial_progress")
      .select("section")
      .eq("user_id", user.id)

    if (error) {
      throw new Error("No se pudo cargar el progreso de los tutoriales")
    }

    return data.map((row) => row.section).filter(isTutorialSection)
  }
)
