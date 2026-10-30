"use server"

import type { Route } from "next"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import { translateAuthError } from "./errors"
import { safeRedirectPath } from "./safe-redirect"
import { signInSchema, signUpSchema } from "./schemas"
import type { AuthFormState, OAuthProvider } from "./types"

const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github"]

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

  redirect(SITE.routes.dashboard as Route)
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

  const callbackUrl = new URL("/auth/callback", SITE.seo.url)
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

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect(SITE.routes.signIn as Route)
}
