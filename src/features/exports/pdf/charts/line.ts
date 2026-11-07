import type { ChartPalette } from "../theme"
import {
  type ChartSize,
  n,
  niceScale,
  shortMonth,
  svgDocument,
  svgLegend,
  svgText,
  svgYAxis
} from "./svg"

const PAD = { top: 18, right: 8, bottom: 16, left: 46 }

/** Línea con un punto por mes (Saldo en cuentas al cierre). null sin datos */
export function lineChart(
  points: { month: string; value: number }[],
  label: string,
  size: ChartSize,
  palette: ChartPalette
) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return null
  }

  const values = points.map((point) => point.value)
  const scale = niceScale(Math.min(...values), Math.max(...values))
  const area = {
    x: PAD.left,
    y: PAD.top,
    width: size.width - PAD.left - PAD.right,
    height: size.height - PAD.top - PAD.bottom
  }
  const axis = svgYAxis(scale, area, palette)
  const slot = area.width / points.length
  const withYear =
    points[0].month.slice(0, 4) !== points.at(-1)?.month.slice(0, 4)
  const coords = points.map((point, index) => ({
    x: area.x + slot * index + slot / 2,
    y: axis.toY(point.value)
  }))

  const path = coords
    .map(
      (coord, index) => `${index === 0 ? "M" : "L"} ${n(coord.x)} ${n(coord.y)}`
    )
    .join(" ")

  let body = `<path d="${path}" fill="none" stroke="${palette.balance}" stroke-width="1.5"/>`
  coords.forEach((coord, index) => {
    body += `<circle cx="${n(coord.x)}" cy="${n(coord.y)}" r="2" fill="${palette.balance}"/>`
    body += svgText(
      coord.x,
      area.y + area.height + 10,
      shortMonth(points[index].month, withYear),
      { anchor: "middle", fill: palette.muted, size: 6.5 }
    )
  })

  return svgDocument(
    size,
    `${svgLegend([{ label, color: palette.balance, line: true }], palette)}${axis.svg}${body}`
  )
}
