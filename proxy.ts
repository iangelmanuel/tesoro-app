import { type NextRequest, NextResponse } from "next/server"
import { SITE } from "@/config/site"
import { updateSession } from "@/libs/supabase/proxy"

const AUTH_ROUTES: string[] = [
  SITE.routes.signIn,
  SITE.routes.signUp,
  SITE.routes.forgotPassword
]

function isDashboardRoute(pathname: string) {
  return (
    pathname === SITE.routes.dashboard ||
    pathname.startsWith(`${SITE.routes.dashboard}/`)
  )
}

// Redirige conservando las cookies que dejó el refresco de sesión
function redirectTo(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  if (!user && isDashboardRoute(pathname)) {
    const url = new URL(SITE.routes.signIn, request.url)
    url.searchParams.set("next", `${pathname}${search}`)
    return redirectTo(url, response)
  }

  // /reset-password necesita la sesión que deja el enlace de recuperación
  if (!user && pathname === SITE.routes.resetPassword) {
    const url = new URL(SITE.routes.forgotPassword, request.url)
    url.searchParams.set("error", "expired")
    return redirectTo(url, response)
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    return redirectTo(new URL(SITE.routes.dashboard, request.url), response)
  }

  return response
}

export const config = {
  matcher: [
    // Todo menos estáticos, optimización de imágenes, metadata e imágenes
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"
  ]
}
