import type { CellValue, Workbook, Worksheet } from "exceljs"
import type { ColumnKind } from "../columns"
import { LOGO_PNG_BASE64 } from "./logo-data"
import {
  type AmountTone,
  COLORS,
  COLUMN_WIDTHS,
  NUMBER_FORMATS,
  TONE_COLORS
} from "./theme"

// Secciones apiladas en vertical: título, encabezados, filas y fila de total.
// Sin celdas combinadas (solo la cabecera de la hoja). Cada sección devuelve
// sus rangos para que otras celdas armen fórmulas A1 con ellos.

/** Fórmula con su valor calculado, para visores sin motor de cálculo */
export interface Formula {
  formula: string
  result: number
}

/** Letras de columna de la sección, por `key` */
export type ColumnLetters<K extends string> = Record<K, string>

export interface SectionColumn<T, K extends string = string> {
  header: string
  key: K
  kind: ColumnKind
  /** Valor de la celda; por defecto `row[key]` */
  value?: (row: T) => CellValue
  /** Fórmula de la celda en la fila `rowNumber`; su `result` es `value` */
  formula?: (rowNumber: number, letters: ColumnLetters<K>, row: T) => string
  /** Color del monto según la fila (ingreso, gasto, traspaso) */
  tone?: (row: T) => AmountTone | null
}

export interface SectionTotal<K extends string> {
  label: string
  /**
   * Celda de total por columna: "sum" suma la columna o una fórmula propia.
   * Las columnas no listadas quedan vacías.
   */
  cells: Partial<
    Record<K, "sum" | ((ranges: SectionRanges<K>) => Formula | number | string)>
  >
}

export interface SectionOptions<T, K extends string> {
  /** Fila donde va el título (o los encabezados, sin título) */
  startRow: number
  title?: string
  columns: SectionColumn<T, K>[]
  rows: T[]
  total?: SectionTotal<K>
  /** Texto de la fila cuando no hay filas */
  emptyText?: string
}

export interface SectionRanges<K extends string> {
  titleRow: number
  headerRow: number
  /** Primera fila de datos */
  firstRow: number
  /** Última fila de datos (igual a firstRow si la sección está vacía) */
  lastRow: number
  totalRow: number | null
  /** Fila donde puede empezar la siguiente sección (deja una en blanco) */
  nextRow: number
  columnLetters: ColumnLetters<K>
  /** Rango A1 de los datos de una columna: "I40:I85" */
  range: (key: K) => string
  /** Celda A1 del total de una columna: "I86" */
  totalCell: (key: K) => string
  /** Valores de las filas, en el mismo orden, para calcular `result` */
  values: (key: K) => number[]
}

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

const roundCents = (value: number) => Math.round(value * 100) / 100

/** El ancho de cada columna es el mayor que le pide cualquier sección */
function widen(sheet: Worksheet, index: number, kind: ColumnKind) {
  const column = sheet.getColumn(index)
  column.width = Math.max(column.width ?? 0, COLUMN_WIDTHS[kind])
}

function cellValue<T, K extends string>(
  column: SectionColumn<T, K>,
  row: T
): CellValue {
  const raw = column.value
    ? column.value(row)
    : (row as Record<string, unknown>)[column.key]

  if (raw === null || raw === undefined || raw === "") return null
  if (column.kind === "date" && typeof raw === "string") return excelDate(raw)
  return raw as CellValue
}

const FORMATS: Partial<Record<ColumnKind, string>> = {
  money: NUMBER_FORMATS.money,
  date: NUMBER_FORMATS.date,
  percent: NUMBER_FORMATS.percent
}

export function writeSection<T, K extends string>(
  sheet: Worksheet,
  accent: string,
  options: SectionOptions<T, K>
): SectionRanges<K> {
  const { startRow, title, columns, rows, total, emptyText } = options
  const letters = Object.fromEntries(
    columns.map((column, index) => [column.key, columnLetter(index + 1)])
  ) as ColumnLetters<K>

  // Sin título (hoja Movimientos) los encabezados van en `startRow`
  const titleRow = startRow
  const headerRow = title ? startRow + 1 : startRow
  const firstRow = headerRow + 1

  if (title) {
    const titleCell = sheet.getCell(titleRow, 1)
    titleCell.value = title
    titleCell.font = { bold: true, size: 12 }
  }

  // Encabezados con el color del espacio y texto blanco
  columns.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1)
    cell.value = column.header
    cell.font = { bold: true, color: { argb: COLORS.white } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } }
    cell.alignment = {
      vertical: "middle",
      horizontal:
        column.kind === "money" || column.kind === "percent" ? "right" : "left"
    }
    widen(sheet, index + 1, column.kind)
  })

  // Filas
  if (rows.length === 0) {
    const cell = sheet.getCell(firstRow, 1)
    cell.value = emptyText ?? "Sin registros"
    cell.font = { italic: true, color: { argb: COLORS.muted } }
  }

  rows.forEach((row, rowIndex) => {
    const rowNumber = firstRow + rowIndex
    columns.forEach((column, index) => {
      const cell = sheet.getCell(rowNumber, index + 1)
      const value = cellValue(column, row)

      cell.value = column.formula
        ? {
            formula: column.formula(rowNumber, letters, row),
            result: typeof value === "number" ? value : 0
          }
        : value

      const format = FORMATS[column.kind]
      if (format) cell.numFmt = format

      const tone = column.tone?.(row)
      if (tone) cell.font = { color: { argb: TONE_COLORS[tone] } }
    })
  })

  const lastRow = rows.length === 0 ? firstRow : firstRow + rows.length - 1

  const values = (key: K) => {
    const column = columns.find((item) => item.key === key)
    if (!column) return []
    return rows.map((row) => {
      const value = cellValue(column, row)
      return typeof value === "number" ? value : 0
    })
  }

  const ranges: SectionRanges<K> = {
    titleRow,
    headerRow,
    firstRow,
    lastRow,
    totalRow: null,
    nextRow: lastRow + 2,
    columnLetters: letters,
    range: (key) => `${letters[key]}${firstRow}:${letters[key]}${lastRow}`,
    totalCell: (key) => `${letters[key]}${lastRow + 1}`,
    values
  }

  if (total) {
    const totalRow = lastRow + 1
    ranges.totalRow = totalRow
    ranges.nextRow = totalRow + 2

    columns.forEach((column, index) => {
      const cell = sheet.getCell(totalRow, index + 1)
      cell.font = { bold: true }
      cell.border = { top: { style: "thin", color: { argb: COLORS.border } } }

      const spec = total.cells[column.key]
      if (index === 0 && !spec) {
        cell.value = total.label
        return
      }
      if (!spec) return

      if (spec === "sum") {
        cell.value = {
          formula: `SUM(${ranges.range(column.key)})`,
          result: roundCents(values(column.key).reduce((a, b) => a + b, 0))
        }
      } else {
        cell.value = spec(ranges)
      }

      const format = FORMATS[column.kind]
      if (format) cell.numFmt = format
    })
  }

  return ranges
}

/** Filas de la cabecera de la hoja (logo, título, subtítulo) */
export const HEADER_ROWS = 3

/**
 * Cabecera de la hoja: logo, título y subtítulo. Es lo único combinado del
 * libro. Ocupa las filas 1 a 3; la primera sección va en la 5.
 */
export function writeSheetHeader(
  workbook: Workbook,
  sheet: Worksheet,
  options: { title: string; subtitle: string; width: number }
) {
  const lastColumn = columnLetter(Math.max(options.width, 2))

  sheet.mergeCells(`B1:${lastColumn}1`)
  sheet.mergeCells(`B2:${lastColumn}2`)

  const title = sheet.getCell("B1")
  title.value = options.title
  title.font = { bold: true, size: 16 }
  title.alignment = { vertical: "middle" }

  const subtitle = sheet.getCell("B2")
  subtitle.value = options.subtitle
  subtitle.font = { color: { argb: COLORS.muted } }
  subtitle.alignment = { vertical: "top" }

  sheet.getRow(1).height = 24
  sheet.getRow(2).height = 18

  sheet.addImage(logoImage(workbook), {
    tl: { col: 0.15, row: 0.1 },
    ext: { width: 36, height: 36 },
    editAs: "oneCell"
  })
}

// Una sola imagen por libro, compartida por todas las hojas
const LOGO_IDS = new WeakMap<Workbook, number>()

function logoImage(workbook: Workbook) {
  let id = LOGO_IDS.get(workbook)
  if (id === undefined) {
    id = workbook.addImage({ base64: LOGO_PNG_BASE64, extension: "png" })
    LOGO_IDS.set(workbook, id)
  }
  return id
}

/** Fila de la primera sección, debajo de la cabecera */
export const FIRST_SECTION_ROW = HEADER_ROWS + 2
