import type { ChartPalette } from "../theme"
import {
  type ChartSize,
  type LegendItem,
  niceScale,
  shortMonth,
  svgDocument,
  svgLegend,
  svgRect,
  svgText,
  svgYAxis
} from "./svg"

export interface BarSeries {
  label: string
  color: string
  /** Rayado en vez de relleno (tema Ahorro de tinta) */
  hatch?: boolean
}

export interface BarGroup {
  /** YYYY-MM */
  month: string
  values: number[]
}

const PAD = { top: 18, right: 4, bottom: 16, left: 46 }

/**
 * Barras agrupadas por mes, una por serie. Con `signedColors`, cada barra
 * toma el color de su signo (Utilidad: positivos y negativos bajo el eje).
 * null si todo es cero: la sección muestra "Sin datos en este periodo".
 */
export function groupedBarsChart(
  groups: BarGroup[],
  series: BarSeries[],
  size: ChartSize,
  palette: ChartPalette,
  signedColors?: { positive: BarSeries; negative: BarSeries }
) {
  const all = groups.flatMap((group) => group.values)
  if (all.length === 0 || all.every((value) => value === 0)) return null

  const scale = niceScale(Math.min(...all), Math.max(...all))
  const area = {
    x: PAD.left,
    y: PAD.top,
    width: size.width - PAD.left - PAD.right,
    height: size.height - PAD.top - PAD.bottom
  }
  const axis = svgYAxis(scale, area, palette)

  const slot = area.width / groups.length
  const groupWidth = Math.min(slot * 0.7, 40 * series.length)
  const barWidth = groupWidth / series.length
  const withYear =
    groups.length > 0 &&
    groups[0].month.slice(0, 4) !== groups.at(-1)?.month.slice(0, 4)
  const zeroY = axis.toY(0)

  let bars = ""
  groups.forEach((group, groupIndex) => {
    const start = area.x + slot * groupIndex + (slot - groupWidth) / 2

    group.values.forEach((value, seriesIndex) => {
      const style = signedColors
        ? value < 0
          ? signedColors.negative
          : signedColors.positive
        : series[seriesIndex]
      const y = axis.toY(Math.max(value, 0))
      const height = Math.abs(axis.toY(value) - zeroY)
      bars += svgRect(
        start + barWidth * seriesIndex + 0.5,
        y,
        barWidth - 1,
        height,
        style.color,
        {
          stroke: style.hatch || palette.hatch ? palette.stroke : undefined,
          hatch: style.hatch
        }
      )
    })

    bars += svgText(
      area.x + slot * groupIndex + slot / 2,
      area.y + area.height + 10,
      shortMonth(group.month, withYear),
      { anchor: "middle", fill: palette.muted, size: 6.5 }
    )
  })

  const legend: LegendItem[] = signedColors
    ? [{ ...signedColors.positive }, { ...signedColors.negative }]
    : series

  return svgDocument(size, `${svgLegend(legend, palette)}${axis.svg}${bars}`)
}
