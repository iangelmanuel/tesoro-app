import { cache } from "react"
import { redirect } from "next/navigation"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import type { AccountData } from "./types"

// Usuario autenticado, su perfil y si tiene contraseña. Se deduplica por
// request con `cache`.
export const getAccount = cache(async (): Promise<AccountData> => {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(SITE.routes.signIn)
  }

  const [profileResult, passwordResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, currency")
      .eq("id", user.id)
      .single(),
    supabase.rpc("has_password")
  ])

  if (profileResult.error || passwordResult.error) {
    throw new Error("No se pudo cargar la cuenta")
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      newEmail: user.new_email ?? null
    },
    profile: {
      fullName: profileResult.data.full_name,
      avatarUrl: profileResult.data.avatar_url,
      currency: profileResult.data.currency
    },
    hasPassword: passwordResult.data
  }
})
