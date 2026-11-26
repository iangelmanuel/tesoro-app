import "server-only"
import type { TutorialSection } from "@/config/tutorials"
import type { AppSupabase } from "@/libs/supabase/types"

// Progreso de los tutoriales guiados (SPEC 27), con la sesión del usuario.
// Sin fila = pendiente.

/** Marca el tutorial de una sección como completado. true si se guardó */
export async function markTutorialCompleted(
  supabase: AppSupabase,
  userId: string,
  section: TutorialSection
) {
  const { error } = await supabase.from("tutorial_progress").upsert(
    {
      user_id: userId,
      section,
      completed_at: new Date().toISOString()
    },
    { onConflict: "user_id,section" }
  )
  return !error
}

/** Borra todo el progreso del usuario. true si se borró */
export async function clearTutorialProgress(
  supabase: AppSupabase,
  userId: string
) {
  const { error } = await supabase
    .from("tutorial_progress")
    .delete()
    .eq("user_id", userId)
  return !error
}
