"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { SITE } from "@/config/site"
import { translateAuthError } from "@/features/auth/errors"
import { createClient } from "@/libs/supabase/server"
import { AVATARS_BUCKET, removeAvatarFiles } from "./avatar"
import {
  changeEmailSchema,
  changePasswordSchema,
  createPasswordSchema,
  currencySchema,
  profileSchema
} from "./schemas"
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

export async function changeEmail(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const values = { email: readString(formData, "email") }
  const parsed = changeEmailSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: SESSION_EXPIRED, values }
  }

  if (parsed.data.email === user.email) {
    return {
      fieldErrors: { email: ["Ese ya es tu email actual"] },
      values
    }
  }

  // La plantilla email_change enlaza a /auth/confirm con token_hash. Este
  // redirect solo aplica si el proyecto aún usa la plantilla por defecto
  const redirectTo = new URL(SITE.routes.authCallback, SITE.seo.url)
  redirectTo.searchParams.set(
    "next",
    `${SITE.routes.account}?notice=email-confirmed`
  )

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: redirectTo.toString() }
  )

  if (error) {
    return { error: translateAuthError(error), values }
  }

  // Muestra "Cambio pendiente a X" (user.new_email)
  revalidatePath(SITE.routes.account)
  return {
    ok: true,
    success:
      "Te enviamos un enlace a tu correo actual y al nuevo. El cambio se aplica cuando confirmes los dos."
  }
}

export async function changePassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: readString(formData, "currentPassword"),
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword")
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: SESSION_EXPIRED }
  }

  // Verifica la actual. La sesión nueva reemplaza a la anterior en las
  // cookies: es la misma cuenta y el mismo navegador
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword
  })

  if (signInError) {
    return signInError.code === "invalid_credentials"
      ? {
          fieldErrors: {
            currentPassword: ["La contraseña actual no es correcta"]
          }
        }
      : { error: translateAuthError(signInError) }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  })

  if (error) {
    return { error: translateAuthError(error) }
  }

  return { ok: true }
}

export async function createPassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = createPasswordSchema.safeParse({
    password: readString(formData, "password"),
    confirmPassword: readString(formData, "confirmPassword")
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  // Sin esta revisión, una sesión podría cambiar la contraseña sin la actual
  const { data: hasPassword, error: rpcError } =
    await supabase.rpc("has_password")

  if (rpcError) {
    return { error: DEFAULT_ERROR }
  }
  if (hasPassword) {
    return { error: "Ya tienes una contraseña. Cámbiala con la actual" }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  })

  if (error) {
    return { error: translateAuthError(error) }
  }

  // La sección pasa a "Cambiar contraseña"
  revalidatePath(SITE.routes.account)
  return { ok: true }
}
