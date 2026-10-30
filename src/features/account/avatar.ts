import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export const AVATARS_BUCKET = "avatars"

/**
 * Borra los archivos de `avatars/<userId>/`, salvo `keepPath` si llega. Usa la
 * sesión del usuario: las políticas de Storage solo dejan tocar su carpeta.
 * Postgres no puede borrar archivos de Storage, por eso se hace desde aquí.
 */
export async function removeAvatarFiles(
  supabase: SupabaseClient<Database>,
  userId: string,
  keepPath?: string
) {
  const { data: files, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .list(userId)

  if (error) {
    return { error }
  }

  const paths = files
    .map((file) => `${userId}/${file.name}`)
    .filter((path) => path !== keepPath)

  if (paths.length === 0) {
    return { error: null }
  }

  const { error: removeError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .remove(paths)

  return { error: removeError }
}
