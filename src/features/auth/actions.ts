"use server"

import type { Route } from "next"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { translateAuthError } from "./errors"
import { safeRedirectPath } from "./safe-redirect"
import { signInSchema, signUpSchema } from "./schemas"
import type { AuthFormState, OAuthProvider } from "./types"

const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"]

/** Crea la cuenta con email y contraseña y entra al dashboard */
export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { password, ...values } = readFormValues(formData, [
    "fullName",
    "email",
    "password"
  ])

  const parsed = signUpSchema.safeParse({ ...values, password })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName }
    }
  })

  if (error) {
    return { error: translateAuthError(error), values }
  }

  // Sin confirmación de email, signUp deja la sesión abierta. Si el proyecto
  // aún la exige, no hay sesión y no se puede continuar
  if (!data.session) {
    return {
      error: "No se pudo crear la sesión. Intenta iniciar sesión",
      values
    }
  }

  redirect(SITE.routes.dashboard)
}

/** Entra con email y contraseña y vuelve a `next` (solo rutas internas) */
export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { password, ...values } = readFormValues(formData, [
    "email",
    "password"
  ])

  const parsed = signInSchema.safeParse({ ...values, password })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: translateAuthError(error), values }
  }

  redirect(safeRedirectPath(formData.get("next")) as Route)
}

/** Entra con Google o GitHub; vuelve por /auth/callback a `next` */
export async function signInWithOAuth(
  provider: OAuthProvider,
  formData: FormData
) {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    redirect(`${SITE.routes.signIn}?error=oauth` as Route)
  }

  const callbackUrl = new URL(SITE.routes.authCallback, SITE.seo.url)
  callbackUrl.searchParams.set("next", safeRedirectPath(formData.get("next")))

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl.toString() }
  })

  if (error || !data.url) {
    redirect(`${SITE.routes.signIn}?error=oauth` as Route)
  }

  redirect(data.url as Route)
}

/** Cierra solo esta sesión y va a sign-in */
export async function signOut() {
  const supabase = await createClient()
  // Solo esta sesión: el scope por defecto ('global') también borra las
  // sesiones OAuth de los agentes MCP y los deja sin refresh token
  await supabase.auth.signOut({ scope: "local" })

  redirect(SITE.routes.signIn)
}
