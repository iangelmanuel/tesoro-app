"use server"

import type { Route } from "next"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { translateAuthError } from "@/features/auth/errors"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { avatarPublicUrl, isOwnAvatarPath, removeAvatarFiles } from "./avatar"
import { deletionDate } from "./deletion"
import {
  changePasswordSchema,
  createPasswordSchema,
  currencySchema,
  hideAmountsSchema,
  profileSchema
} from "./schemas"
import {
  type ProfileChanges,
  cancelAccountDeletionRecord,
  requestAccountDeletionRecord,
  sessionUser,
  updateProfileRecord,
  userHasPassword
} from "./service"
import type { AccountActionResult, ProfileFormState } from "./types"

const DEFAULT_ERROR = "No se pudieron guardar los cambios. Intenta de nuevo"
const SESSION_EXPIRED = "Tu sesión expiró. Inicia sesión de nuevo"
const AVATAR_ERROR = "No se pudo guardar la foto. Intenta de nuevo"

// El nombre, el avatar y la moneda se ven en el aside y en los montos de todo
// el dashboard: se revalida su layout completo
function revalidateDashboard() {
  revalidatePath(SITE.routes.dashboard, "layout")
}

async function updateOwnProfile(changes: ProfileChanges) {
  const supabase = await createClient()
  const user = await sessionUser(supabase)

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  return (await updateProfileRecord(supabase, user.id, changes))
    ? {}
    : { error: DEFAULT_ERROR }
}

/** Cambia el nombre del perfil */
export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const values = readFormValues(formData, ["fullName"])
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

/** Cambia la moneda de los montos */
export async function updateCurrency(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const values = readFormValues(formData, ["currency"])
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

/** Ocultar montos: preferencia global (Personal, Empresa y dispositivos) */
export async function setHideAmountsAction(
  hidden: unknown
): Promise<AccountActionResult> {
  const parsed = hideAmountsSchema.safeParse(hidden)

  if (!parsed.success) {
    return { error: DEFAULT_ERROR }
  }

  const { error } = await updateOwnProfile({ hide_amounts: parsed.data })

  if (error) {
    return { error }
  }

  revalidateDashboard()
  return {}
}

/** Guarda la foto ya subida a la carpeta propia y borra las anteriores */
export async function setAvatar(path: unknown): Promise<AccountActionResult> {
  const supabase = await createClient()
  const user = await sessionUser(supabase)

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  if (!isOwnAvatarPath(user.id, path)) {
    return { error: AVATAR_ERROR }
  }

  const { error } = await updateOwnProfile({
    avatar_url: avatarPublicUrl(supabase, path)
  })

  if (error) {
    return { error: AVATAR_ERROR }
  }

  // Deja un solo archivo en la carpeta. Si falla, la foto nueva ya quedó
  await removeAvatarFiles(supabase, user.id, path)

  revalidateDashboard()
  return {}
}

/** Quita la foto de perfil */
export async function removeAvatar(): Promise<AccountActionResult> {
  const supabase = await createClient()
  const user = await sessionUser(supabase)

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

/** Cambia la contraseña verificando la actual */
export async function changePassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = changePasswordSchema.safeParse(
    readFormValues(formData, ["currentPassword", "password", "confirmPassword"])
  )

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const user = await sessionUser(supabase)

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

/** Crea la contraseña de una cuenta que entró solo con OAuth */
export async function createPassword(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = createPasswordSchema.safeParse(
    readFormValues(formData, ["password", "confirmPassword"])
  )

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const user = await sessionUser(supabase)

  if (!user) {
    return { error: SESSION_EXPIRED }
  }

  // Sin esta revisión, una sesión podría cambiar la contraseña sin la actual
  const hasPassword = await userHasPassword(supabase)

  if (hasPassword === null) {
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

/** Programa el borrado de la cuenta y cierra la sesión */
export async function requestAccountDeletion(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const confirmEmail = readFormValues(formData, [
    "confirmEmail"
  ]).confirmEmail.trim()

  const supabase = await createClient()
  const user = await sessionUser(supabase)

  if (!user?.email) {
    return { error: SESSION_EXPIRED }
  }

  // El botón ya se habilita solo con el email exacto; se revalida aquí
  if (confirmEmail !== user.email) {
    return {
      fieldErrors: { confirmEmail: ["Escribe tu email exactamente igual"] }
    }
  }

  // Postgres no puede borrar archivos de Storage: la foto se borra ahora, con
  // la sesión del usuario. Si restaura la cuenta, vuelve sin foto
  const { error: storageError } = await removeAvatarFiles(supabase, user.id)
  if (storageError) {
    return { error: DEFAULT_ERROR }
  }

  const { error: profileError } = await updateOwnProfile({ avatar_url: null })
  if (profileError) {
    return { error: profileError }
  }

  const requestedAt = await requestAccountDeletionRecord(supabase)

  if (requestedAt === null) {
    return { error: "No se pudo programar el borrado. Intenta de nuevo" }
  }

  await supabase.auth.signOut()

  const params = new URLSearchParams({
    notice: "account-deletion-scheduled",
    date: deletionDate(requestedAt)
  })
  redirect(`${SITE.routes.signIn}?${params}` as Route)
}

/** Cancela el borrado programado y vuelve al dashboard */
export async function cancelAccountDeletion(): Promise<AccountActionResult> {
  const supabase = await createClient()

  if (!(await cancelAccountDeletionRecord(supabase))) {
    return { error: "No se pudo restaurar la cuenta. Intenta de nuevo" }
  }

  // El JWT guardado aún trae la marca en app_metadata: se renueva
  await supabase.auth.refreshSession()

  redirect(SITE.routes.dashboardPersonal)
}
