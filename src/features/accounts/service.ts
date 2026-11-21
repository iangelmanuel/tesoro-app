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

export const ACCOUNT_NOT_FOUND = "No se encontró la cuenta"
export const ACCOUNT_DUPLICATE_NAME = "Ya existe una cuenta con ese nombre"
const ACCOUNT_DEFAULT_ERROR = "No se pudo guardar la cuenta. Intenta de nuevo"

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

/** Cambia solo los campos de `patch`; los demás quedan igual */
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
