import { type NextRequest, NextResponse } from "next/server"
import { SITE } from "@/config/site"
import { deletionRequestedAt } from "@/features/account/deletion"
import { updateSession } from "@/libs/supabase/proxy"

const AUTH_ROUTES: string[] = [SITE.routes.signIn, SITE.routes.signUp]

function isDashboardRoute(pathname: string) {
  return (
    pathname === SITE.routes.dashboard ||
    pathname.startsWith(`${SITE.routes.dashboard}/`)
  )
}

// Rutas que exigen sesión y una cuenta sin marca de borrado: el dashboard y
// el consentimiento OAuth de agentes MCP (SPEC 34)
function isProtectedRoute(pathname: string) {
  return isDashboardRoute(pathname) || pathname === SITE.routes.oauthConsent
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

  if (!user && isProtectedRoute(pathname)) {
    const url = new URL(SITE.routes.signIn, request.url)
    url.searchParams.set("next", `${pathname}${search}`)
    return redirectTo(url, response)
  }

  // Periodo de gracia del borrado: la marca llega en el getUser() de arriba
  // (app_metadata), sin otra consulta
  const isMarked = user !== null && deletionRequestedAt(user) !== null

  if (pathname === SITE.routes.accountDeleted) {
    if (!user) {
      return redirectTo(new URL(SITE.routes.signIn, request.url), response)
    }
    if (!isMarked) {
      return redirectTo(new URL(SITE.routes.dashboard, request.url), response)
    }
  }

  if (isMarked && isProtectedRoute(pathname)) {
    return redirectTo(
      new URL(SITE.routes.accountDeleted, request.url),
      response
    )
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
