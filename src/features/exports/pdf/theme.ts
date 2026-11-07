import type { Style, StyleDictionary } from "pdfmake/interfaces"
import type { WorkspaceType } from "@/features/workspaces/queries"
import type { PdfOptions } from "../types"
import {
  type AmountTone,
  COLORS,
  TONE_COLORS,
  workbookPalette
} from "../workbook/theme"
import { FONT, FONT_SEMIBOLD } from "./fonts"

// Temas del PDF (SPEC 33). Los colores salen de `workbook/theme.ts`, que
// refleja los tokens de globals.css: no se duplican valores. Las secciones
// leen el tema; ninguna fija un color a mano.
//
// Contraste (WCAG 2.x) del tema Color, heredado del Excel:
// - blanco / accent: 5.36 Personal, 5.22 Empresa (banda de título)
// - accentDark / accentTint: 7.13 Personal, 6.91 Empresa (encabezados)
// - income / zebra 5.19, expense / zebra 5.01, muted / zebra 5.61
// El tema Ahorro de tinta usa texto ≥ #4b5563 sobre blanco.

export interface PdfTheme {
  variant: PdfOptions["theme"]
  /** Del espacio: emerald en Personal, naranja en Empresa */
  accent: string
  accentDark: string
  /** Relleno de encabezados de columna (solo "color") */
  accentTint: string
  /** Relleno de la fila de total (solo "color") */
  totalTint: string
  text: string
  muted: string
  white: string
  /** Líneas finas de tablas y separadores */
  line: string
  /** Grosor de las líneas finas, en puntos */
  lineWidth: number
  /** Filas alternas; null en "ink" */
  zebra: string | null
  /** false en "ink": ningún relleno de color */
  filled: boolean
  tone: Record<AmountTone, string>
  /** Gráficas SVG (`charts/*`) */
  chart: ChartPalette
  /** true en "ink": los montos llevan + o − en vez de color */
  signedAmounts: boolean
  styles: StyleDictionary
  defaultStyle: Style
}

export interface ChartPalette {
  /** Serie de entradas (ingresos, ventas) */
  income: string
  /** Serie de salidas (gastos, costos) */
  expense: string
  /** Línea de saldo */
  balance: string
  /** Barras del top de categorías */
  bar: string
  /** Porciones de la dona y barras de categorías, en orden */
  categories: string[]
  /** Porción "Otras" */
  others: string
  /** Rayado sobre la segunda serie y los negativos ("ink": sin color) */
  hatch: boolean
  /** Trazo de contorno de barras y porciones */
  stroke: string
  axis: string
  grid: string
  text: string
  muted: string
}

/** "FF00784F" (ARGB del Excel) → "#00784F" */
function hex(argb: string) {
  return `#${argb.slice(2)}`
}

/** Gris del tema Ahorro de tinta para textos atenuados */
const INK_MUTED = "#4B5563"

function buildStyles(colors: {
  text: string
  muted: string
  accentDark: string
  tableTitle: string
}): StyleDictionary {
  return {
    coverTitle: { font: FONT, fontSize: 30, bold: true, color: colors.text },
    coverSubtitle: {
      font: FONT_SEMIBOLD,
      fontSize: 16,
      color: colors.accentDark
    },
    coverMeta: { fontSize: 11, color: colors.muted },
    pageTitle: {
      font: FONT,
      fontSize: 18,
      bold: true,
      color: colors.accentDark,
      margin: [0, 0, 0, 12]
    },
    sectionTitle: {
      font: FONT_SEMIBOLD,
      fontSize: 12,
      color: colors.text,
      margin: [0, 12, 0, 6]
    },
    body: { fontSize: 10, lineHeight: 1.3 },
    small: { fontSize: 8, color: colors.muted },
    muted: { color: colors.muted },
    headerText: { font: FONT_SEMIBOLD, fontSize: 9, color: colors.text },
    headerMeta: { fontSize: 9, color: colors.muted },
    footerText: { fontSize: 8, color: colors.muted },
    tableTitle: {
      font: FONT_SEMIBOLD,
      fontSize: 10,
      color: colors.tableTitle
    },
    tableHeader: { fontSize: 8.5, bold: true, color: colors.accentDark },
    cell: { fontSize: 9 },
    cellCompact: { fontSize: 8 },
    amount: { alignment: "right" },
    total: { bold: true },
    empty: { fontSize: 9, italics: true, color: colors.muted }
  }
}

export function pdfTheme(
  type: WorkspaceType,
  variant: PdfOptions["theme"]
): PdfTheme {
  const palette = workbookPalette(type)
  const accent = hex(palette.accent)
  const accentDark = hex(palette.accentDark)
  const text = hex(COLORS.ink)
  const defaultStyle: Style = { font: FONT, fontSize: 10, color: text }

  if (variant === "ink") {
    return {
      variant,
      accent,
      accentDark,
      accentTint: hex(COLORS.white),
      totalTint: hex(COLORS.white),
      text,
      muted: INK_MUTED,
      white: hex(COLORS.white),
      line: INK_MUTED,
      lineWidth: 0.75,
      zebra: null,
      filled: false,
      tone: { income: text, expense: text, transfer: text },
      // Grises escalonados, trazos y rayado en vez de color
      chart: {
        income: hex(COLORS.chart1),
        expense: hex(COLORS.white),
        balance: text,
        bar: hex(COLORS.chart4),
        categories: [
          hex(COLORS.chart3),
          hex(COLORS.chart1),
          hex(COLORS.chart4),
          hex(COLORS.chart2),
          hex(COLORS.chart5),
          hex(COLORS.gridline)
        ],
        others: hex(COLORS.white),
        hatch: true,
        stroke: text,
        axis: INK_MUTED,
        grid: hex(COLORS.gridline),
        text,
        muted: INK_MUTED
      },
      signedAmounts: true,
      styles: buildStyles({
        text,
        muted: INK_MUTED,
        accentDark,
        tableTitle: accentDark
      }),
      defaultStyle
    }
  }

  const muted = hex(COLORS.muted)
  return {
    variant,
    accent,
    accentDark,
    accentTint: hex(palette.header),
    totalTint: hex(palette.total),
    text,
    muted,
    white: hex(COLORS.white),
    line: hex(COLORS.gridline),
    lineWidth: 0.5,
    zebra: hex(COLORS.zebra),
    filled: true,
    tone: {
      income: hex(TONE_COLORS.income),
      expense: hex(TONE_COLORS.expense),
      transfer: hex(TONE_COLORS.transfer)
    },
    chart: {
      income: hex(COLORS.income),
      expense: hex(COLORS.expense),
      balance: hex(COLORS.balance),
      bar: hex(COLORS.expense),
      // El acento del espacio y la serie neutra --chart-*
      categories: [
        accent,
        hex(COLORS.chart3),
        hex(COLORS.chart1),
        hex(COLORS.chart4),
        hex(COLORS.chart2),
        hex(COLORS.chart5)
      ],
      others: hex(COLORS.gridline),
      hatch: false,
      stroke: hex(COLORS.white),
      axis: muted,
      grid: hex(COLORS.gridline),
      text,
      muted
    },
    signedAmounts: false,
    styles: buildStyles({
      text,
      muted,
      accentDark,
      tableTitle: hex(COLORS.white)
    }),
    defaultStyle
  }
}
