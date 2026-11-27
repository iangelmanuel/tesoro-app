// Tamaño de pantalla del dashboard (SPEC 57). El navegador lo guarda en una
// cookie que el servidor lee: así el primer render ya sabe si monta el aside
// de escritorio o la barra inferior y la hoja del teléfono, sin pintar uno y
// cambiarlo por el otro. Sin cookie (primera visita) se montan los dos y el
// CSS oculta el que no toca, como antes

/** Escritorio o teléfono; `unknown` monta los dos */
export type Viewport = "mobile" | "desktop" | "unknown"

export const VIEWPORT_COOKIE = "tesoro-viewport"

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** Valor de cookie → viewport; ausente o inválido → `unknown` */
export function parseViewport(value: string | undefined): Viewport {
  return value === "mobile" || value === "desktop" ? value : "unknown"
}

/** Guarda el viewport en la cookie del navegador (solo en el cliente) */
export function saveViewport(viewport: Exclude<Viewport, "unknown">) {
  document.cookie = `${VIEWPORT_COOKIE}=${viewport}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}

/** Si una parte propia de `target` se monta con el viewport actual */
export function mountsOn(
  viewport: Viewport,
  target: Exclude<Viewport, "unknown">
) {
  return viewport === "unknown" || viewport === target
}
