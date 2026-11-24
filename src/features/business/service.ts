import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { BusinessInput } from "./schemas"

// Escrituras de una empresa: crearla con su perfil, editarla y programar o
// cancelar su borrado (30 días de gracia). Las actions redirigen y
// revalidan.

/** Error cuando la empresa no existe o no es del usuario */
export const NOT_FOUND = "No se encontró la empresa"
const DEFAULT_ERROR = "No se pudo guardar la empresa. Intenta de nuevo"
// Mensaje del trigger check_business_limit
const LIMIT_REACHED = "Alcanzaste el límite de empresas"
const INVALID_TAX_ID = "Revisa el formato del NIT"
const DELETE_ERROR = "No se pudo programar el borrado. Intenta de nuevo"
const RESTORE_ERROR = "No se pudo restaurar la empresa. Intenta de nuevo"

function businessPgError(error: PostgrestError): ServiceFailure {
  if (error.message.includes(LIMIT_REACHED)) {
    return fail({ error: LIMIT_REACHED })
  }
  // Check de business_profiles.tax_id, por si el cliente se salta Zod
  if (error.code === "23514" && error.message.includes("tax_id")) {
    return fail({ fieldErrors: { tax_id: [INVALID_TAX_ID] } })
  }
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar esta empresa" })
  }
  return fail({ error: DEFAULT_ERROR })
}

/**
 * Crea el espacio y su perfil en una transacción (create_business). La BD
 * aplica el límite de empresas. Devuelve el id del espacio nuevo.
 */
export async function createBusinessRecord(
  supabase: AppSupabase,
  data: BusinessInput
): Promise<ServiceResult<{ id: string }>> {
  const { data: id, error } = await supabase.rpc("create_business", {
    p_name: data.name,
    // La RPC acepta null aunque los tipos generados digan string
    p_tax_id: data.tax_id as string,
    p_sector: data.sector
  })

  if (error) {
    return businessPgError(error)
  }
  return { ok: true, id }
}

/**
 * Edita una empresa: el nombre en workspaces (único campo editable del
 * espacio) y NIT y sector en business_profiles
 */
export async function updateBusinessRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  data: BusinessInput
): Promise<ServiceResult<object>> {
  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .update({ tax_id: data.tax_id, sector: data.sector })
    .eq("workspace_id", workspace.id)
    .select("workspace_id")

  if (profileError) {
    return businessPgError(profileError)
  }
  if (profile.length === 0) {
    return fail({ error: NOT_FOUND })
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: data.name })
    .eq("id", workspace.id)

  if (error) {
    return businessPgError(error)
  }
  return { ok: true }
}

/** Programa el borrado de una empresa (30 días de gracia) */
export async function requestBusinessDeletionRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("request_workspace_deletion", {
    p_workspace_id: workspace.id
  })
  return error ? fail({ error: DELETE_ERROR }) : { ok: true }
}

/**
 * Quita la marca de borrado. La RPC solo actúa sobre empresas del usuario,
 * así que un id ajeno no cambia nada
 */
export async function cancelBusinessDeletionRecord(
  supabase: AppSupabase,
  workspaceId: string
): Promise<ServiceResult<object>> {
  const { error } = await supabase.rpc("cancel_workspace_deletion", {
    p_workspace_id: workspaceId
  })
  return error ? fail({ error: RESTORE_ERROR }) : { ok: true }
}
