"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import { currencySchema, profileSchema } from "./schemas"
import type { ProfileFormState } from "./types"

const DEFAULT_ERROR = "No se pudieron guardar los cambios. Intenta de nuevo"

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
  changes: { full_name: string } | { currency: string }
) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Tu sesión expiró. Inicia sesión de nuevo" }
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
