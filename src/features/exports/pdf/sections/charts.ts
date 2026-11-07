import type { Content } from "pdfmake/interfaces"
import { groupTopWithOthers } from "@/features/reports/metrics"
import { donutChart } from "../charts/donut"
import { groupedBarsChart } from "../charts/grouped-bars"
import { horizontalBarsChart } from "../charts/horizontal-bars"
import { lineChart } from "../charts/line"
import type { ChartSize } from "../charts/svg"
import type { PdfContext, PdfReportData } from "../types"
import { monthRows } from "./period-summary"

// Página de gráficas (SPEC 33): cuatro gráficas en SVG propio, en una grilla
// de 2 × 2 que toma el ancho útil de la página. Con un solo mes, las dos
// gráficas por mes se reemplazan por una tarjeta; sin datos, cada gráfica
// muestra "Sin datos en este periodo".

const DONUT_SLICES = 6
const TOP_CATEGORIES = 8
const GAP = 20

const TITLES = {
  personal: {
    byMonth: "Ingresos vs gastos por mes",
    in: "Ingresos",
    out: "Gastos",
    donut: "Gastos por categoría",
    top: "Top categorías de gasto",
    fourth: "Saldo en cuentas al cierre"
  },
  business: {
    byMonth: "Ventas vs costos por mes",
    in: "Ventas",
    out: "Costos",
    donut: "Costos por categoría",
    top: "Top categorías de costo",
    fourth: "Utilidad por mes"
  }
} as const

/** Recuadro del tamaño de la gráfica con un texto centrado */
function placeholder(ctx: PdfContext, size: ChartSize, text: string): Content {
  const { theme } = ctx
  return {
    table: {
      widths: ["*"],
      heights: [size.height],
      body: [
        [
          {
            text,
            style: "empty",
            alignment: "center",
            margin: [0, size.height / 2 - 8, 0, 0]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => (theme.filled ? 0 : theme.lineWidth),
      vLineWidth: () => (theme.filled ? 0 : theme.lineWidth),
      hLineColor: () => theme.line,
      vLineColor: () => theme.line,
      fillColor: () => (theme.filled ? theme.zebra : null)
    }
  }
}

function chartBlock(
  ctx: PdfContext,
  title: string,
  svg: string | null,
  size: ChartSize
): Content {
  return {
    stack: [
      { text: title, style: "sectionTitle", margin: [0, 0, 0, 8] },
      svg
        ? { svg, width: size.width, height: size.height }
        : placeholder(ctx, size, "Sin datos en este periodo")
    ],
    unbreakable: true
  }
}

export function chartsSection(ctx: PdfContext, data: PdfReportData): Content[] {
  const { theme, page } = ctx
  const palette = theme.chart
  const titles = TITLES[ctx.type]
  const landscape = page.width > page.height
  const size: ChartSize = {
    width: (page.contentWidth - GAP) / 2,
    height: landscape ? 150 : 190
  }
  const rows = monthRows(data)
  const singleMonth = rows.length === 1

  const { top, others } = groupTopWithOthers(data.categoryTotals, DONUT_SLICES)
  const slices = [
    ...top,
    ...(others ? [{ name: "Otras", total: others.total, others: true }] : [])
  ]

  const donut = chartBlock(
    ctx,
    titles.donut,
    donutChart(slices, size, palette),
    size
  )
  const topBars = chartBlock(
    ctx,
    titles.top,
    horizontalBarsChart(
      data.categoryTotals.slice(0, TOP_CATEGORIES),
      size,
      palette,
      palette.bar
    ),
    size
  )

  const heading: Content = {
    text: "Gráficas",
    style: "pageTitle",
    pageBreak: "before"
  }

  if (singleMonth) {
    return [
      heading,
      placeholder(
        ctx,
        { width: page.contentWidth, height: 48 },
        "Un solo mes: compara periodos más largos para ver la tendencia."
      ),
      { columns: [donut, topBars], columnGap: GAP, margin: [0, GAP, 0, 0] }
    ]
  }

  const outSeries = {
    label: titles.out,
    color: palette.expense,
    hatch: palette.hatch
  }
  const byMonth = chartBlock(
    ctx,
    titles.byMonth,
    groupedBarsChart(
      rows.map((row) => ({ month: row.month, values: [row.in, row.out] })),
      [{ label: titles.in, color: palette.income }, outSeries],
      size,
      palette
    ),
    size
  )

  const fourth = chartBlock(
    ctx,
    titles.fourth,
    ctx.type === "personal"
      ? lineChart(
          rows.map((row) => ({ month: row.month, value: row.closing })),
          "Saldo al cierre",
          size,
          palette
        )
      : groupedBarsChart(
          rows.map((row) => ({ month: row.month, values: [row.net] })),
          [{ label: "Utilidad", color: palette.income }],
          size,
          palette,
          {
            positive: { label: "Utilidad", color: palette.income },
            negative: { ...outSeries, label: "Pérdida" }
          }
        ),
    size
  )

  return [
    heading,
    { columns: [byMonth, donut], columnGap: GAP, margin: [0, 0, 0, GAP] },
    { columns: [topBars, fourth], columnGap: GAP }
  ]
}
