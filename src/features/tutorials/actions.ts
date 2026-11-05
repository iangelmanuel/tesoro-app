"use server"

import { revalidatePath } from "next/cache"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import { tutorialSectionSchema } from "./schemas"
import type { TutorialActionResult } from "./types"

const DEFAULT_ERROR = "No se pudo guardar el progreso. Intenta de nuevo"
const SESSION_EXPIRED = "Tu sesión expiró. Inicia sesión de nuevo"

// El progreso se lee en el layout del dashboard (TutorialProvider)
function revalidateDashboard() {
  revalidatePath(SITE.routes.dashboard, "layout")
}

async function getUserClient() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return { supabase, user }
}

/** Marca el tutorial de una sección como completado (al terminar el último paso) */
export async function completeTutorialAction(
  section: unknown
): Promise<TutorialActionResult> {
  const parsed = tutorialSectionSchema.safeParse(section)

  if (!parsed.success) {
    return { error: DEFAULT_ERROR }
  }

  const { supabase, user } = await getUserClient()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  const { error } = await supabase.from("tutorial_progress").upsert(
    {
      user_id: user.id,
      section: parsed.data,
      completed_at: new Date().toISOString()
    },
    { onConflict: "user_id,section" }
  )

  if (error) {
    return { error: DEFAULT_ERROR }
  }

  revalidateDashboard()
  return {}
}

/** Borra todo el progreso: los tutoriales vuelven a arrancar solos */
export async function resetTutorialsAction(): Promise<TutorialActionResult> {
  const { supabase, user } = await getUserClient()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  const { error } = await supabase
    .from("tutorial_progress")
    .delete()
    .eq("user_id", user.id)

  if (error) {
    return { error: DEFAULT_ERROR }
  }

  revalidateDashboard()
  return {}
}
