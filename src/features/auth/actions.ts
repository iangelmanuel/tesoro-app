"use server"

import type { Route } from "next"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import { translateAuthError } from "./errors"
import { safeRedirectPath } from "./safe-redirect"
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema
} from "./schemas"
import type { AuthFormState, OAuthProvider } from "./types"

const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"]

const RATE_LIMIT_ERRORS = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit"
])

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = {
    fullName: readString(formData, "fullName"),
    email: readString(formData, "email")
  }

  const parsed = signUpSchema.safeParse({
    ...values,
    password: readString(formData, "password")
  })

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } }
  })

  if (error) {
    return { error: translateAuthError(error), values }
  }

  redirect(SITE.routes.dashboard)
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = { email: readString(formData, "email") }

  const parsed = signInSchema.safeParse({
    ...values,
    password: readString(formData, "password")
  })

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

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = { email: readString(formData, "email") }
  const parsed = forgotPasswordSchema.safeParse(values)

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  // La plantilla recovery enlaza a /auth/confirm con token_hash. redirectTo
  // solo aplica si el proyecto aún usa la plantilla por defecto (código PKCE)
  const redirectTo = new URL(SITE.routes.authCallback, SITE.seo.url)
  redirectTo.searchParams.set("next", SITE.routes.resetPassword)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: redirectTo.toString() }
  )

  // Misma respuesta exista o no el email, para no enumerar cuentas
  if (error?.code && RATE_LIMIT_ERRORS.has(error.code)) {
    return { error: "Demasiados intentos, espera unos minutos", values }
  }

  return {
    success: "Si existe una cuenta con ese email, te enviamos un enlace"
  }
}

export async function resetPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
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
    redirect(`${SITE.routes.forgotPassword}?error=expired` as Route)
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password
  })

  if (error) {
    return { error: translateAuthError(error) }
  }

  // El formulario muestra el toast y navega a /dashboard
  return { success: "Tu contraseña se actualizó" }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect(SITE.routes.signIn)
}
