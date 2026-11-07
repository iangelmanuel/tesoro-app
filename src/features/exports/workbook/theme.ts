import type { Worksheet } from "exceljs"
import type { WorkspaceType } from "@/features/workspaces/queries"
import type { ColumnKind } from "../columns"

// Colores ARGB del libro. Los base copian los valores en claro de globals.css
// (convertidos de OKLCH a sRGB); si cambian allá, se actualizan aquí:
// - accent: --accent de [data-workspace="personal"] (emerald-700) y de
//   [data-workspace="business"] (orange-700)
// - income / expense: --income / --expense de :root
// - muted: --muted de :root (traspasos y textos atenuados)
// Los tintes (encabezado, total) y el tono oscuro son propios del libro.
// Contraste verificado (WCAG 2.x):
// - blanco / accent: 5.36 Personal, 5.22 Empresa (banda de título)
// - accentDark / header: 7.13 Personal, 6.91 Empresa (encabezados)
// - ink / total: 11.54 Personal, 11.00 Empresa (fila de total)
// - income / zebra 5.19, expense / zebra 5.01, muted / zebra 5.61
export const COLORS = {
  income: "FF00784F",
  expense: "FFD8001E",
  muted: "FF5D646F",
  ink: "FF1F2937",
  white: "FFFFFFFF",
  zebra: "FFF6F8FA",
  gridline: "FFE3E7EC"
} as const

export interface WorkbookPalette {
  /** Banda de título, borde exterior y línea de la cabecera */
  accent: string
  /** Texto de los encabezados de columna */
  accentDark: string
  /** Relleno de los encabezados de columna */
  header: string
  /** Relleno de la fila de total */
  total: string
}

const PALETTES: Record<WorkspaceType, WorkbookPalette> = {
  personal: {
    accent: "FF007A55",
    accentDark: "FF005C40",
    header: "FFE7F4EE",
    total: "FFCDEBDC"
  },
  business: {
    accent: "FFCA3500",
    accentDark: "FF9A2800",
    header: "FFFCEEE6",
    total: "FFF8D9C7"
  }
}

export function workbookPalette(type: WorkspaceType) {
  return PALETTES[type]
}

export const NUMBER_FORMATS = {
  /** COP sin decimales: "$ 35.000" en Excel es-CO */
  money: '"$" #,##0',
  date: "dd/mm/yyyy",
  percent: "0.0%"
} as const

/** Ancho mínimo por tipo de columna, en caracteres */
export const MIN_COLUMN_WIDTHS: Record<ColumnKind, number> = {
  date: 12,
  time: 8,
  text: 14,
  money: 14,
  percent: 11
}

/** Ancho máximo de cualquier columna: los textos largos se ajustan */
export const MAX_COLUMN_WIDTH = 44

export type AmountTone = "income" | "expense" | "transfer"

export const TONE_COLORS: Record<AmountTone, string> = {
  income: COLORS.income,
  expense: COLORS.expense,
  transfer: COLORS.muted
}

/**
 * Termina una hoja: sin líneas de cuadrícula (las celdas fuera de las tablas
 * quedan en blanco) e impresión A4 vertical, una página de ancho y pie
 * "Tesoro · <hoja> · Página N de M"
 */
export function finishSheet(sheet: Worksheet) {
  const views = sheet.views.length > 0 ? sheet.views : [{}]
  sheet.views = views.map((view) => ({ ...view, showGridLines: false }))

  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3
    }
  }
  sheet.headerFooter.oddFooter = `&CTesoro · ${sheet.name} · Página &P de &N`
}
