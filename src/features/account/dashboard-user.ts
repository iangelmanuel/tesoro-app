import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"

/**
 * Usuario del dashboard con su perfil: nombre, correo, avatar y si oculta
 * las cifras. Sin sesión redirige a iniciar sesión. Lee la sesión (cookies):
 * va dentro de un Suspense por cacheComponents. cache() la comparte entre el
 * aside y el título del header en el request.
 */
export const getDashboardUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(SITE.routes.signIn)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, hide_amounts")
    .eq("id", user.id)
    .single()

  return {
    name: profile?.full_name ?? user.email ?? "",
    email: user.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    hideAmounts: profile?.hide_amounts ?? false
  }
})
