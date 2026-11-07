import { formatCompactCurrency } from "@/components/charts/chart-format"
import { FONT } from "../fonts"
import type { ChartPalette } from "../theme"

// Piezas comunes de las gráficas SVG del PDF (SPEC 33). Solo `rect`, `path`,
// `line`, `circle`, `text` y `g`, sin CSS, filtros ni `foreignObject`: lo que
// el conversor de pdfmake (svg-to-pdfkit) dibuja como vector. Todo texto pasa
// por `escapeXml`: los nombres de categoría vienen del usuario.

export interface ChartSize {
  width: number
  height: number
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

/** Número con hasta dos decimales, para coordenadas */
export const n = (value: number) => String(Math.round(value * 100) / 100)

/** Monto abreviado de los ejes y etiquetas: "$ 1,2 M", con "−" tipográfico */
export const compact = (value: number) =>
  formatCompactCurrency(value).replace("-", "−")

export function svgDocument(size: ChartSize, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(size.width)}" height="${n(size.height)}" viewBox="0 0 ${n(size.width)} ${n(size.height)}" font-family="${FONT}">${body}</svg>`
}

interface TextOptions {
  size?: number
  anchor?: "start" | "middle" | "end"
  fill: string
  bold?: boolean
}

export function svgText(
  x: number,
  y: number,
  value: string,
  options: TextOptions
) {
  const anchor = options.anchor ?? "start"
  const weight = options.bold ? ' font-weight="bold"' : ""
  return `<text x="${n(x)}" y="${n(y)}" font-size="${n(options.size ?? 7)}" text-anchor="${anchor}" fill="${options.fill}"${weight}>${escapeXml(value)}</text>`
}

export function svgLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width = 0.5
) {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${n(width)}"/>`
}

/** Rectángulo; con `hatch`, contorno y rayado horizontal en vez de relleno */
export function svgRect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  options: { stroke?: string; hatch?: boolean } = {}
) {
  if (width <= 0 || height <= 0) return ""

  const stroke = options.stroke
    ? ` stroke="${options.stroke}" stroke-width="0.6"`
    : ""
  let out = `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${fill}"${stroke}/>`

  if (options.hatch && options.stroke) {
    for (let lineY = y + 2.5; lineY < y + height; lineY += 2.5) {
      out += svgLine(x, lineY, x + width, lineY, options.stroke, 0.4)
    }
  }
  return out
}

/** Escala con marcas en valores redondos (1, 2, 2,5 o 5 × 10ⁿ) que incluye 0 */
export function niceScale(minValue: number, maxValue: number, ticks = 4) {
  const min = Math.min(0, minValue)
  const max = Math.max(0, maxValue)
  if (min === max) return { min: 0, max: 1, values: [0] }

  const rough = (max - min) / ticks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * magnitude)
      .find((candidate) => candidate >= rough) ?? 10 * magnitude

  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const values: number[] = []
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    values.push(Math.round(value * 100) / 100)
  }
  return { min: niceMin, max: niceMax, values }
}

export interface LegendItem {
  label: string
  color: string
  /** Rayado (tema Ahorro de tinta) */
  hatch?: boolean
  /** Línea en vez de cuadro */
  line?: boolean
}

/** Leyenda en una fila, arriba a la izquierda */
export function svgLegend(items: LegendItem[], palette: ChartPalette, y = 6) {
  let x = 0
  let out = ""
  for (const item of items) {
    out += item.line
      ? svgLine(x, y - 2.5, x + 10, y - 2.5, item.color, 1.5)
      : svgRect(x, y - 6, 7, 7, item.color, {
          stroke: item.hatch || palette.hatch ? palette.stroke : undefined,
          hatch: item.hatch
        })
    out += svgText(x + (item.line ? 13 : 10), y, item.label, {
      fill: palette.text
    })
    x += (item.line ? 13 : 10) + item.label.length * 3.6 + 12
  }
  return out
}

/** Eje Y con líneas de guía y montos abreviados */
export function svgYAxis(
  scale: { min: number; max: number; values: number[] },
  area: { x: number; y: number; width: number; height: number },
  palette: ChartPalette
) {
  const toY = (value: number) =>
    area.y +
    area.height -
    ((value - scale.min) / (scale.max - scale.min)) * area.height

  let out = ""
  for (const value of scale.values) {
    const y = toY(value)
    out += svgLine(
      area.x,
      y,
      area.x + area.width,
      y,
      value === 0 ? palette.axis : palette.grid,
      value === 0 ? 0.6 : 0.4
    )
    out += svgText(area.x - 4, y + 2.3, compact(value), {
      anchor: "end",
      fill: palette.muted,
      size: 6.5
    })
  }
  return { svg: out, toY }
}

const SHORT_MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic"
]

/** "Oct" o "Oct 25" si el periodo cruza de año */
export function shortMonth(month: string, withYear: boolean) {
  const [year, index] = month.split("-")
  const label = SHORT_MONTHS[Number(index) - 1]
  return withYear ? `${label} ${year.slice(2)}` : label
}

/** Recorta un texto largo con "…" */
export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
