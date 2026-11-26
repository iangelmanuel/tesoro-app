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
  const { response, claims } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  if (!claims && isProtectedRoute(pathname)) {
    const url = new URL(SITE.routes.signIn, request.url)
    url.searchParams.set("next", `${pathname}${search}`)
    return redirectTo(url, response)
  }

  // Periodo de gracia del borrado: la marca llega en el app_metadata del JWT,
  // sin otra consulta. Pedir el borrado cierra la sesión y cancelarlo la
  // refresca, así el siguiente JWT ya trae (o pierde) la marca
  const isMarked =
    claims !== null && deletionRequestedAt(claims.app_metadata) !== null

  if (pathname === SITE.routes.accountDeleted) {
    if (!claims) {
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

  if (claims && AUTH_ROUTES.includes(pathname)) {
    return redirectTo(new URL(SITE.routes.dashboard, request.url), response)
  }

  return response
}

export const config = {
  matcher: [
    // Todo menos estáticos, optimización de imágenes, metadata e imágenes.
    // Tampoco el MCP (api/mcp) ni el descubrimiento OAuth (.well-known): no
    // usan cookies, se autentican con Bearer (SPEC 34)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|api/mcp(?:/|$)|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"
  ]
}
