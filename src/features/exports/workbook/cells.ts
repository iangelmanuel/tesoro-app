import type { Borders, CellValue, Worksheet } from "exceljs"
import type { ColumnKind } from "../columns"
import {
  COLORS,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTHS,
  NUMBER_FORMATS,
  type WorkbookPalette
} from "./theme"

// Piezas de celda y estilo que comparten las tablas del libro: letras de
// columna, fechas de Excel, formatos, alineación, anchos y el marco.

/** Letra A1 de la columna `index` (1 → A, 27 → AA) */
export function columnLetter(index: number) {
  let letter = ""
  let n = index
  while (n > 0) {
    const remainder = (n - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

/** Fecha real de Excel desde YYYY-MM-DD, con componentes UTC */
export function excelDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Caracteres que ocupa un valor ya formateado, para el ancho de columna */
export function displayLength(value: CellValue, kind: ColumnKind) {
  if (value === null || value === undefined) return 0
  switch (kind) {
    case "money": {
      const digits = String(Math.round(Math.abs(Number(value)))).length
      // "$ " + dígitos + puntos de miles
      return digits + Math.floor((digits - 1) / 3) + 2
    }
    case "percent":
      return 7
    case "date":
      return 10
    case "time":
      return 5
    default:
      return String(value).length
  }
}

/**
 * El ancho de cada columna es el mayor que le pide cualquier tabla de la
 * hoja: su contenido más largo, con un mínimo por tipo y un máximo
 */
export function widen(
  sheet: Worksheet,
  index: number,
  kind: ColumnKind,
  chars: number
) {
  const column = sheet.getColumn(index)
  const wanted = Math.min(
    Math.max(chars + 3, MIN_COLUMN_WIDTHS[kind]),
    MAX_COLUMN_WIDTH
  )
  column.width = Math.max(column.width ?? 0, wanted)
}

/** Formato numérico de Excel por tipo de columna */
export const FORMATS: Partial<Record<ColumnKind, string>> = {
  money: NUMBER_FORMATS.money,
  date: NUMBER_FORMATS.date,
  percent: NUMBER_FORMATS.percent
}

/** Alineación horizontal por tipo de columna */
export const ALIGN: Record<ColumnKind, "left" | "center" | "right"> = {
  text: "left",
  date: "center",
  time: "center",
  money: "right",
  percent: "right"
}

/** Relleno sólido de un color ARGB */
export const solid = (argb: string) =>
  ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const

/**
 * Borde grueso exterior del color del espacio y bordes finos grises por
 * dentro, en el rectángulo [top, bottom] × [1, width]
 */
export function frame(
  sheet: Worksheet,
  palette: WorkbookPalette,
  top: number,
  bottom: number,
  width: number,
  heavyRows: Set<number>
) {
  const inner = { style: "thin", color: { argb: COLORS.gridline } } as const
  const outer = { style: "medium", color: { argb: palette.accent } } as const

  for (let row = top; row <= bottom; row++) {
    for (let col = 1; col <= width; col++) {
      const border: Partial<Borders> = {
        top: row === top || heavyRows.has(row) ? outer : inner,
        bottom: row === bottom ? outer : inner,
        left: col === 1 ? outer : inner,
        right: col === width ? outer : inner
      }
      sheet.getCell(row, col).border = border
    }
  }
}
