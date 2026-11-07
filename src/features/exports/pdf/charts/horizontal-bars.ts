import type { ChartPalette } from "../theme"
import {
  type ChartSize,
  compact,
  svgDocument,
  svgRect,
  svgText,
  truncate
} from "./svg"

const LABEL_WIDTH = 92
const VALUE_WIDTH = 46

/**
 * Top de categorías en barras horizontales, de mayor a menor, con el monto
 * abreviado al final. null sin datos.
 */
export function horizontalBarsChart(
  items: { name: string; total: number }[],
  size: ChartSize,
  palette: ChartPalette,
  color: string
) {
  const rows = items.filter((item) => item.total > 0)
  if (rows.length === 0) return null

  const max = Math.max(...rows.map((row) => row.total))
  // Con pocas categorías las filas no se estiran a todo el alto
  const rowHeight = Math.min(size.height / rows.length, 22)
  const barHeight = Math.min(rowHeight * 0.6, 14)
  const barArea = size.width - LABEL_WIDTH - VALUE_WIDTH

  let body = ""
  rows.forEach((row, index) => {
    const centerY = rowHeight * index + rowHeight / 2
    body += svgText(LABEL_WIDTH - 6, centerY + 2.4, truncate(row.name, 22), {
      anchor: "end",
      fill: palette.text
    })
    body += svgRect(
      LABEL_WIDTH,
      centerY - barHeight / 2,
      Math.max((row.total / max) * barArea, 1),
      barHeight,
      color,
      { stroke: palette.hatch ? palette.stroke : undefined }
    )
    body += svgText(
      LABEL_WIDTH + (row.total / max) * barArea + 4,
      centerY + 2.4,
      compact(row.total),
      { fill: palette.muted, size: 6.5 }
    )
  })

  return svgDocument(size, body)
}
