import "server-only"
import type { AppSupabase } from "@/libs/supabase/types"

// Escrituras de Cuenta (SPEC 09 y 22), con la sesión del usuario: el perfil
// propio, la contraseña y el borrado programado de la cuenta.

/** Campos del perfil que se cambian desde Cuenta, uno por acción */
export type ProfileChanges =
  | { full_name: string }
  | { currency: string }
  | { avatar_url: string | null }
  | { hide_amounts: boolean }

/** Id del usuario de la sesión con su email, o null sin sesión */
export async function sessionUser(supabase: AppSupabase) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
}

/** Actualiza el perfil propio. true si se guardó */
export async function updateProfileRecord(
  supabase: AppSupabase,
  userId: string,
  changes: ProfileChanges
) {
  const { error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", userId)
  return !error
}

/** Si la cuenta ya tiene contraseña, o null si la consulta falla */
export async function userHasPassword(supabase: AppSupabase) {
  const { data, error } = await supabase.rpc("has_password")
  return error ? null : data
}

/** Programa el borrado de la cuenta; devuelve cuándo se pidió, o null */
export async function requestAccountDeletionRecord(supabase: AppSupabase) {
  const { data, error } = await supabase.rpc("request_account_deletion")
  return error ? null : data
}

/** Cancela el borrado programado. true si se canceló */
export async function cancelAccountDeletionRecord(supabase: AppSupabase) {
  const { error } = await supabase.rpc("cancel_account_deletion")
  return !error
}
