import { cache } from "react"
import { redirect } from "next/navigation"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"

export type PersonalWorkspace = {
  id: string
  name: string
  currency: string
}

// Workspace Personal del usuario autenticado. Se valida la sesión contra el
// servidor de auth (getUser) y se deduplica por request con `cache`.
export const getPersonalWorkspace = cache(
  async (): Promise<PersonalWorkspace> => {
    const supabase = await createClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      redirect(SITE.routes.signIn)
    }

    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, profiles (currency)")
      .eq("owner_id", user.id)
      .eq("type", "personal")
      .single()

    if (error || !data) {
      throw new Error("No se encontró el espacio Personal del usuario")
    }

    return {
      id: data.id,
      name: data.name,
      currency: data.profiles.currency
    }
  }
)
