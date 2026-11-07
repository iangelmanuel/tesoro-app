import type { Worksheet } from "exceljs"
import type { WorkspaceType } from "@/features/workspaces/queries"
import type { ColumnKind } from "../columns"

// Colores ARGB del libro. Copian los valores en claro de globals.css
// (convertidos de OKLCH a sRGB); si cambian allá, se actualizan aquí:
// - personal: --accent de [data-workspace="personal"] (emerald-700)
// - business: --accent de [data-workspace="business"] (orange-700)
// - income / expense: --income / --expense de :root
// - muted: --muted de :root (traspasos y textos atenuados)
// Blanco sobre personal da 5.36:1 y sobre business 5.22:1 (AA).
export const COLORS = {
  personal: "FF007A55",
  business: "FFCA3500",
  income: "FF00784F",
  expense: "FFD8001E",
  muted: "FF5D646F",
  white: "FFFFFFFF",
  border: "FFD9DDE3"
} as const

export function accentColor(type: WorkspaceType) {
  return type === "personal" ? COLORS.personal : COLORS.business
}

export const NUMBER_FORMATS = {
  /** COP sin decimales: "$ 35.000" en Excel es-CO */
  money: '"$" #,##0',
  date: "dd/mm/yyyy",
  percent: "0.0%"
} as const

/** Ancho fijo por tipo de columna, en caracteres */
export const COLUMN_WIDTHS: Record<ColumnKind, number> = {
  date: 12,
  time: 8,
  text: 26,
  money: 16,
  percent: 11
}

export type AmountTone = "income" | "expense" | "transfer"

export const TONE_COLORS: Record<AmountTone, string> = {
  income: COLORS.income,
  expense: COLORS.expense,
  transfer: COLORS.muted
}

/** A4 vertical, una página de ancho y pie "Tesoro · <hoja> · Página N de M" */
export function applyPrintSetup(sheet: Worksheet) {
  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
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
