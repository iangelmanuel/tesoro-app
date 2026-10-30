import { type NextRequest, NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { SITE } from "@/config/site"
import { safeRedirectPath } from "@/features/auth/safe-redirect"
import { createClient } from "@/libs/supabase/server"

// Tipos de enlace que envían las plantillas de supabase/templates/
const EMAIL_OTP_TYPES = new Set<string>(["email", "recovery", "email_change"])

/**
 * Verifica los enlaces de email (`token_hash` + `type`): confirmación de
 * registro, recuperación de contraseña y cambio de email. A diferencia del
 * `code` PKCE de /auth/callback, funciona aunque el correo se abra en otro
 * navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = safeRedirectPath(searchParams.get("next"))

  if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    })

    if (!error) {
      const url = new URL(next, request.url)
      // Con double_confirm_changes cada correo confirma por separado: la
      // página de cuenta avisa por si aún falta el otro enlace
      if (type === "email_change") {
        url.searchParams.set("notice", "email-confirmed")
      }
      return NextResponse.redirect(url)
    }
  }

  const signInUrl = new URL(SITE.routes.signIn, request.url)
  signInUrl.searchParams.set("error", "link")
  return NextResponse.redirect(signInUrl)
}
