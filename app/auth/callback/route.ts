import { type NextRequest, NextResponse } from "next/server"
import { SITE } from "@/config/site"
import { safeRedirectPath } from "@/features/auth/safe-redirect"
import { createClient } from "@/libs/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const next = safeRedirectPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  const signInUrl = new URL(SITE.routes.signIn, request.url)
  signInUrl.searchParams.set("error", "oauth")
  return NextResponse.redirect(signInUrl)
}
