"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import { AVATARS_BUCKET, removeAvatarFiles } from "./avatar"
import { currencySchema, profileSchema } from "./schemas"
import type { AccountActionResult, ProfileFormState } from "./types"

const DEFAULT_ERROR = "No se pudieron guardar los cambios. Intenta de nuevo"
const SESSION_EXPIRED = "Tu sesión expiró. Inicia sesión de nuevo"
const AVATAR_ERROR = "No se pudo guardar la foto. Intenta de nuevo"

// <user_id>/<uuid>.webp, tal como lo sube avatar-uploader
const AVATAR_FILE = /^[0-9a-f-]{36}\.webp$/

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

// El nombre, el avatar y la moneda se ven en el aside y en los montos de todo
// el dashboard: se revalida su layout completo
function revalidateDashboard() {
  revalidatePath(SITE.routes.dashboard, "layout")
}

async function updateOwnProfile(
  changes:
    { full_name: string } | { currency: string } | { avatar_url: string | null }
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  const { error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", user.id)

  return error ? { error: DEFAULT_ERROR } : {}
}

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const values = { fullName: readString(formData, "fullName") }
  const parsed = profileSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { error } = await updateOwnProfile({
    full_name: parsed.data.fullName
  })

  if (error) {
    return { error, values }
  }

  revalidateDashboard()
  return { ok: true }
}

export async function updateCurrency(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const values = { currency: readString(formData, "currency") }
  const parsed = currencySchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const { error } = await updateOwnProfile({ currency: parsed.data.currency })

  if (error) {
    return { error, values }
  }

  revalidateDashboard()
  return { ok: true }
}

export async function setAvatar(path: unknown): Promise<AccountActionResult> {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  // Solo archivos de la carpeta propia (las políticas de Storage también lo
  // exigen al subir)
  const prefix = `${user.id}/`
  if (
    typeof path !== "string" ||
    !path.startsWith(prefix) ||
    !AVATAR_FILE.test(path.slice(prefix.length))
  ) {
    return { error: AVATAR_ERROR }
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)

  const { error } = await updateOwnProfile({ avatar_url: publicUrl })

  if (error) {
    return { error: AVATAR_ERROR }
  }

  // Deja un solo archivo en la carpeta. Si falla, la foto nueva ya quedó
  await removeAvatarFiles(supabase, user.id, path)

  revalidateDashboard()
  return {}
}

export async function removeAvatar(): Promise<AccountActionResult> {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  const { error: storageError } = await removeAvatarFiles(supabase, user.id)

  if (storageError) {
    return { error: "No se pudo quitar la foto. Intenta de nuevo" }
  }

  const { error } = await updateOwnProfile({ avatar_url: null })

  if (error) {
    return { error }
  }

  revalidateDashboard()
  return {}
}
