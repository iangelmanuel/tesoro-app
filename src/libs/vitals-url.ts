// Prefijo de las rutas de una empresa: /dashboard/business/<id>/…
const BUSINESS_ID = /^(\/dashboard\/business\/)[^/]+/

/**
 * URL que se envía a Vercel Speed Insights (SPEC 56c). Sin query string ni
 * hash (`?next=…`, filtros de Movimientos) y con el id de la empresa
 * cambiado por `[id]`, para que ninguna métrica salga con datos del usuario.
 */
export function normalizeVitalsUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Relativa o mal formada: se corta igual y se trata como ruta
    const path = url.split(/[?#]/, 1)[0] ?? ""
    return path.replace(BUSINESS_ID, "$1[id]")
  }
  return `${parsed.origin}${parsed.pathname.replace(BUSINESS_ID, "$1[id]")}`
}
