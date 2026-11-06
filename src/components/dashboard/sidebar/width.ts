// Ancho del aside de escritorio (px). Se guarda por navegador en una cookie
// que el servidor lee para que el primer render salga con el ancho correcto

export const SIDEBAR_WIDTH = {
  min: 240,
  max: 360,
  default: 256,
  step: 16
} as const

export const SIDEBAR_WIDTH_COOKIE = "tesoro-sidebar-width"

/** Lleva un ancho en px al rango permitido, en enteros */
export function clampSidebarWidth(width: number) {
  return Math.min(
    SIDEBAR_WIDTH.max,
    Math.max(SIDEBAR_WIDTH.min, Math.round(width))
  )
}

/** Valor de cookie → px dentro del rango; inválido → default */
export function parseSidebarWidth(value: string | undefined): number {
  if (!value?.trim()) return SIDEBAR_WIDTH.default
  const width = Number(value)
  if (!Number.isFinite(width)) return SIDEBAR_WIDTH.default
  return clampSidebarWidth(width)
}
