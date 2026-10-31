import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"

export type WorkspaceType = Database["public"]["Enums"]["workspace_type"]

export type PersonalWorkspace = {
  id: string
  name: string
  currency: string
}

export type Workspace = {
  id: string
  type: WorkspaceType
  name: string
  currency: string
  deletionRequestedAt: string | null
}

export type BusinessWorkspace = Workspace & {
  taxId: string | null
  sector: string
}

const NOT_WRITABLE = "No puedes modificar este espacio"

const idSchema = z.uuid()

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

// Espacio por id, o null si no existe o no es del usuario: la política select
// de workspaces solo devuelve los del dueño. Deduplicado por request.
const findWorkspace = cache(async (id: string): Promise<Workspace | null> => {
  if (!idSchema.safeParse(id).success) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, type, name, deletion_requested_at, profiles (currency)")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw new Error("No se pudo cargar el espacio")
  }
  if (!data) {
    return null
  }

  return {
    id: data.id,
    type: data.type,
    name: data.name,
    currency: data.profiles.currency,
    deletionRequestedAt: data.deletion_requested_at
  }
})

/** Espacio del usuario por id. Si no existe o es ajeno, 404 */
export async function getWorkspace(id: string): Promise<Workspace> {
  const workspace = await findWorkspace(id)
  if (!workspace) {
    notFound()
  }
  return workspace
}

/** Empresas del usuario con su perfil, de la más antigua a la más nueva */
export const getBusinessWorkspaces = cache(
  async (): Promise<BusinessWorkspace[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("workspaces")
      .select(
        "id, type, name, deletion_requested_at, profiles (currency), business_profiles (tax_id, sector)"
      )
      .eq("type", "business")
      .order("created_at", { ascending: true })

    if (error) {
      throw new Error("No se pudieron cargar las empresas")
    }

    return data.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      currency: row.profiles.currency,
      deletionRequestedAt: row.deletion_requested_at,
      taxId: row.business_profiles?.tax_id ?? null,
      sector: row.business_profiles?.sector ?? "other"
    }))
  }
)

/**
 * Para Server Actions: el espacio debe ser del usuario y no estar programado
 * para borrarse. Si no, lanza un error. RLS (is_workspace_writable) lo vuelve
 * a validar al escribir.
 */
export async function requireWritableWorkspace(
  id: unknown
): Promise<Workspace> {
  const parsed = idSchema.safeParse(id)
  const workspace = parsed.success ? await findWorkspace(parsed.data) : null

  if (!workspace || workspace.deletionRequestedAt !== null) {
    throw new Error(NOT_WRITABLE)
  }
  return workspace
}
