import type { ChartPalette } from "../theme"
import { type ChartSize, n, svgDocument, svgLine, svgText } from "./svg"

const STROKE = 14
/** Límites de las bandas (Regular, Bueno, Excelente), como en `BANDS` */
const BAND_LIMITS = [40, 60, 80]

/** Punto del semicírculo para un score de 0 (izquierda) a 100 (derecha) */
function point(cx: number, cy: number, radius: number, score: number) {
  const angle = Math.PI * (1 - score / 100)
  return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) }
}

function arc(cx: number, cy: number, radius: number, from: number, to: number) {
  const start = point(cx, cy, radius, from)
  const end = point(cx, cy, radius, to)
  return `M ${n(start.x)} ${n(start.y)} A ${n(radius)} ${n(radius)} 0 0 1 ${n(end.x)} ${n(end.y)}`
}

/**
 * Medidor semicircular del score (0–100): pista, tramo hasta el score en
 * `color`, marcas en los límites de las bandas y el número al centro
 */
export function gaugeChart(
  score: number,
  size: ChartSize,
  palette: ChartPalette,
  color: string
) {
  const cx = size.width / 2
  const radius = Math.min(size.width / 2, size.height) - STROKE / 2 - 2
  const cy = radius + STROKE / 2 + 2
  const value = Math.min(Math.max(score, 0), 100)

  let body = `<path d="${arc(cx, cy, radius, 0, 100)}" fill="none" stroke="${palette.grid}" stroke-width="${STROKE}"/>`
  if (value > 0) {
    body += `<path d="${arc(cx, cy, radius, 0, value)}" fill="none" stroke="${color}" stroke-width="${STROKE}"/>`
  }

  for (const limit of BAND_LIMITS) {
    const inner = point(cx, cy, radius - STROKE / 2 - 2, limit)
    const outer = point(cx, cy, radius + STROKE / 2 + 1, limit)
    body += svgLine(inner.x, inner.y, outer.x, outer.y, palette.axis, 0.8)
  }

  body += svgText(cx, cy - 6, String(Math.round(value)), {
    anchor: "middle",
    fill: palette.text,
    size: 28,
    bold: true
  })
  body += svgText(cx, cy + 8, "de 100", {
    anchor: "middle",
    fill: palette.muted,
    size: 8
  })
  body += svgText(cx - radius, cy + 12, "0", {
    anchor: "middle",
    fill: palette.muted,
    size: 6.5
  })
  body += svgText(cx + radius, cy + 12, "100", {
    anchor: "middle",
    fill: palette.muted,
    size: 6.5
  })

  return svgDocument(size, body)
}
