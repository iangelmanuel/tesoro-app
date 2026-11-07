import { percentShares } from "@/features/reports/metrics"
import type { ChartPalette } from "../theme"
import {
  type ChartSize,
  compact,
  n,
  svgDocument,
  svgRect,
  svgText,
  truncate
} from "./svg"

export interface DonutSlice {
  name: string
  total: number
  /** "Otras" */
  others?: boolean
}

const LEGEND_ROW = 13

/** Trazo de una porción de anillo entre dos ángulos (radianes, 0 arriba) */
function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number
) {
  // Una porción de 360° no se dibuja con un solo arco
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001)
  const finish = start + sweep
  const point = (radius: number, angle: number) =>
    `${n(cx + radius * Math.sin(angle))} ${n(cy - radius * Math.cos(angle))}`
  const large = sweep > Math.PI ? 1 : 0

  return [
    `M ${point(outer, start)}`,
    `A ${n(outer)} ${n(outer)} 0 ${large} 1 ${point(outer, finish)}`,
    `L ${point(inner, finish)}`,
    `A ${n(inner)} ${n(inner)} 0 ${large} 0 ${point(inner, start)}`,
    "Z"
  ].join(" ")
}

/**
 * Dona con el top de categorías y "Otras", total al centro y leyenda con el
 * porcentaje de cada porción. null sin datos.
 */
export function donutChart(
  slices: DonutSlice[],
  size: ChartSize,
  palette: ChartPalette
) {
  const rows = slices.filter((slice) => slice.total > 0)
  const total = rows.reduce((sum, slice) => sum + slice.total, 0)
  if (total <= 0) return null

  const shares = percentShares(rows.map((slice) => slice.total))
  const outer = Math.min(size.height / 2 - 2, size.width * 0.22)
  const inner = outer * 0.62
  const cx = outer + 2
  const cy = size.height / 2
  const colorOf = (slice: DonutSlice, index: number) =>
    slice.others ? palette.others : palette.categories[index]

  let body = ""
  let angle = 0
  rows.forEach((slice, index) => {
    const end = angle + (slice.total / total) * Math.PI * 2
    body += `<path d="${arcPath(cx, cy, outer, inner, angle, end)}" fill="${colorOf(slice, index)}" stroke="${palette.stroke}" stroke-width="${palette.hatch ? 0.6 : 1}"/>`
    angle = end
  })

  body += svgText(cx, cy + 1, compact(total), {
    anchor: "middle",
    fill: palette.text,
    size: 8,
    bold: true
  })
  body += svgText(cx, cy + 9, "Total", {
    anchor: "middle",
    fill: palette.muted,
    size: 6
  })

  const legendX = cx + outer + 14
  const legendTop = cy - (rows.length * LEGEND_ROW) / 2 + 8
  rows.forEach((slice, index) => {
    const y = legendTop + index * LEGEND_ROW
    body += svgRect(legendX, y - 6, 7, 7, colorOf(slice, index), {
      stroke: palette.hatch || slice.others ? palette.axis : undefined
    })
    body += svgText(legendX + 11, y, truncate(slice.name, 20), {
      fill: palette.text
    })
    body += svgText(
      size.width - 2,
      y,
      `${String(shares[index]).replace(".", ",")} %`,
      { anchor: "end", fill: palette.muted, size: 6.5 }
    )
  })

  return svgDocument(size, body)
}
