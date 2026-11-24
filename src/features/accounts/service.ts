import "server-only"
import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/features/workspaces/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { AccountInput } from "./schemas"
import type { AccountRow } from "./types"

// Crear y editar cuentas (SPEC 44). Lo comparten las Server Actions y el
// MCP: recibe el cliente y un espacio ya resuelto con permiso de escritura y
// devuelve la fila antes y después para el log.

/** Error cuando la cuenta no existe o no es del espacio */
export const ACCOUNT_NOT_FOUND = "No se encontró la cuenta"
/** Error del campo `name` con un nombre que ya usa otra cuenta del espacio */
export const ACCOUNT_DUPLICATE_NAME = "Ya existe una cuenta con ese nombre"
const ACCOUNT_DEFAULT_ERROR = "No se pudo guardar la cuenta. Intenta de nuevo"
const ARCHIVE_ERROR = "No se pudo actualizar la cuenta. Intenta de nuevo"

function accountPgError(error: PostgrestError): ServiceFailure {
  // Índice único accounts_unique_name (espacio, nombre sin mayúsculas)
  if (error.code === "23505") {
    return fail({ fieldErrors: { name: [ACCOUNT_DUPLICATE_NAME] } })
  }
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar esta cuenta" })
  }
  return fail({ error: ACCOUNT_DEFAULT_ERROR })
}

/** Crea una cuenta en el espacio. Un nombre repetido vuelve como error del campo `name` */
export async function createAccountRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  data: AccountInput
): Promise<ServiceResult<{ after: AccountRow }>> {
  const { data: after, error } = await supabase
    .from("accounts")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return accountPgError(error)
  }
  return { ok: true, after }
}

/** Cuenta del espacio por id, o null */
export async function loadAccount(
  supabase: AppSupabase,
  workspaceId: string,
  id: string
): Promise<AccountRow | null> {
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  return data
}

/**
 * Edita una cuenta: cambia solo los campos de `patch`; los demás quedan
 * igual
 */
export async function updateAccountRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  patch: Partial<AccountInput>
): Promise<ServiceResult<{ before: AccountRow; after: AccountRow }>> {
  const before = await loadAccount(supabase, workspace.id, id)
  if (!before) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }

  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return accountPgError(error)
  }
  const after = data[0]
  if (!after) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }
  return { ok: true, before, after }
}

/**
 * Archiva (`archived: true`) o restaura una cuenta. Solo cambia si está en
 * el estado contrario; si no, responde que no se encontró.
 */
export async function setAccountArchived(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  archived: boolean
): Promise<ServiceResult<object>> {
  const query = supabase
    .from("accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workspace_id", workspace.id)

  const { data, error } = await (
    archived
      ? query.is("archived_at", null)
      : query.not("archived_at", "is", null)
  ).select("id")

  if (error) {
    return fail({ error: ARCHIVE_ERROR })
  }
  if (data.length === 0) {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }
  return { ok: true }
}
