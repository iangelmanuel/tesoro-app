import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/** Bucket público de las fotos de perfil (1 MB, solo WebP) */
export const AVATARS_BUCKET = "avatars"

// <user_id>/<uuid>.webp, tal como lo sube avatar-uploader
const AVATAR_FILE = /^[0-9a-f-]{36}\.webp$/

/**
 * El archivo es una foto de la carpeta propia (las políticas de Storage
 * también lo exigen al subir)
 */
export function isOwnAvatarPath(userId: string, path: unknown): path is string {
  const prefix = `${userId}/`
  return (
    typeof path === "string" &&
    path.startsWith(prefix) &&
    AVATAR_FILE.test(path.slice(prefix.length))
  )
}

/** URL pública de un archivo del bucket de avatares */
export function avatarPublicUrl(
  supabase: SupabaseClient<Database>,
  path: string
) {
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl
}

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
