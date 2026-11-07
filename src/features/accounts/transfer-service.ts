import type { PostgrestError } from "@supabase/supabase-js"
import {
  type ServiceFailure,
  type ServiceResult,
  type ServiceWorkspace,
  fail
} from "@/libs/service-result"
import type { AppSupabase } from "@/libs/supabase/types"
import type { Database } from "@/types/database"
import type { TransferInput } from "./schemas"

// Lógica de crear, editar y borrar traspasos (SPEC 34). La comparten las
// Server Actions y el MCP: recibe el cliente y un espacio ya resuelto con
// permiso de escritura, y devuelve las filas antes y después.

export type TransferRow = Database["public"]["Tables"]["transfers"]["Row"]

const ACCOUNT_NOT_FOUND = "No se encontró la cuenta"
export const TRANSFER_NOT_FOUND = "No se encontró el traspaso"
const TRANSFER_DEFAULT_ERROR =
  "No se pudo guardar el traspaso. Intenta de nuevo"
const DELETE_ERROR = "No se pudo eliminar el traspaso. Intenta de nuevo"
const ACCOUNT_ARCHIVED = "La cuenta está archivada"
const SAME_ACCOUNT = "Elige una cuenta distinta a la de origen"

// check_account_active lanza check_violation con su mensaje; la FK compuesta
// falla si la cuenta no es del espacio
function transferPgError(error: PostgrestError): ServiceFailure {
  if (error.message.includes(ACCOUNT_ARCHIVED)) {
    return fail({ error: ACCOUNT_ARCHIVED })
  }
  if (error.code === "23514") {
    return fail({ fieldErrors: { to_account_id: [SAME_ACCOUNT] } })
  }
  if (error.code === "23503") {
    return fail({ error: ACCOUNT_NOT_FOUND })
  }
  if (error.code === "42501") {
    return fail({ error: "No tienes permiso para modificar este traspaso" })
  }
  return fail({ error: TRANSFER_DEFAULT_ERROR })
}

export async function createTransferRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  data: TransferInput
): Promise<ServiceResult<{ after: TransferRow }>> {
  const { data: after, error } = await supabase
    .from("transfers")
    .insert({ ...data, workspace_id: workspace.id })
    .select("*")
    .single()

  if (error) {
    return transferPgError(error)
  }
  return { ok: true, after }
}

export async function updateTransferRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string,
  data: TransferInput
): Promise<ServiceResult<{ before: TransferRow; after: TransferRow }>> {
  const { data: before } = await supabase
    .from("transfers")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  if (!before) {
    return fail({ error: TRANSFER_NOT_FOUND })
  }

  const { data: updated, error } = await supabase
    .from("transfers")
    .update(data)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return transferPgError(error)
  }
  const after = updated[0]
  if (!after) {
    return fail({ error: TRANSFER_NOT_FOUND })
  }
  return { ok: true, before, after }
}

export async function deleteTransferRecord(
  supabase: AppSupabase,
  workspace: ServiceWorkspace,
  id: string
): Promise<ServiceResult<{ before: TransferRow }>> {
  const { data, error } = await supabase
    .from("transfers")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")

  if (error) {
    return fail({ error: DELETE_ERROR })
  }
  const before = data[0]
  if (!before) {
    return fail({ error: TRANSFER_NOT_FOUND })
  }
  return { ok: true, before }
}
