import { SITE } from "@/config/site"

/**
 * Devuelve `next` solo si es una ruta interna (empieza con `/`, no con `//`
 * ni `/\`), para evitar open redirects. Si no, devuelve el dashboard.
 */
export function safeRedirectPath(next: unknown): string {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return SITE.routes.dashboard
  }

  return next
}
