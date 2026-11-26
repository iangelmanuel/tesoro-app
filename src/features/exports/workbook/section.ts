import type { CellValue, Worksheet } from "exceljs"
import { roundCents } from "@/libs/money"
import type { ColumnKind } from "../columns"
import {
  ALIGN,
  FORMATS,
  columnLetter,
  displayLength,
  excelDate,
  frame,
  solid,
  widen
} from "./cells"
import {
  type AmountTone,
  COLORS,
  TONE_COLORS,
  type WorkbookPalette
} from "./theme"

// Cada tabla es un bloque apilado en vertical: banda de título combinada,
// encabezados, filas alternas y fila de total, con borde grueso exterior y
// bordes finos internos. Fuera de las tablas no hay bordes (las hojas no
// muestran cuadrícula). Solo se combinan la banda de título y el aviso de
// tabla vacía: datos y totales nunca, para que ordenar, filtrar y las
// fórmulas sigan funcionando. Cada tabla devuelve sus rangos para que otras
// celdas armen fórmulas A1 con ellos.

/** Fórmula con su valor calculado, para visores sin motor de cálculo */
export interface Formula {
  formula: string
  result: number
}

/** Letras de columna de la sección, por `key` */
export type ColumnLetters<K extends string> = Record<K, string>

/** Una columna de la tabla */
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

/** Fila de total de la tabla */
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

/** Lo que necesita `writeSection` */
export interface SectionOptions<T, K extends string> {
  /** Fila de la banda de título */
  startRow: number
  title: string
  columns: SectionColumn<T, K>[]
  rows: T[]
  total?: SectionTotal<K>
  /** Texto de la fila cuando no hay filas */
  emptyText?: string
}

/** Filas y rangos A1 de una tabla ya escrita */
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

/**
 * Escribe una tabla desde `startRow` y devuelve sus rangos, para que otras
 * celdas armen fórmulas A1 con ellos
 */
export function writeSection<T, K extends string>(
  sheet: Worksheet,
  palette: WorkbookPalette,
  options: SectionOptions<T, K>
): SectionRanges<K> {
  const { startRow, title, columns, rows, total, emptyText } = options
  const width = columns.length
  const letters = Object.fromEntries(
    columns.map((column, index) => [column.key, columnLetter(index + 1)])
  ) as ColumnLetters<K>

  const titleRow = startRow
  const headerRow = startRow + 1
  const firstRow = headerRow + 1
  const lastRow = rows.length === 0 ? firstRow : firstRow + rows.length - 1
  const totalRow = total ? lastRow + 1 : null
  const bottomRow = totalRow ?? lastRow

  // Banda de título: combinada a lo ancho de la tabla, grande y en blanco
  // sobre el color del espacio
  for (let col = 1; col <= width; col++) {
    sheet.getCell(titleRow, col).fill = solid(palette.accent)
  }
  const titleCell = sheet.getCell(titleRow, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 13, color: { argb: COLORS.white } }
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 }
  if (width > 1) sheet.mergeCellsWithoutStyle(titleRow, 1, titleRow, width)
  sheet.getRow(titleRow).height = 24

  // Encabezados con un tinte del espacio
  columns.forEach((column, index) => {
    const cell = sheet.getCell(headerRow, index + 1)
    cell.value = column.header
    cell.font = { bold: true, color: { argb: palette.accentDark } }
    cell.fill = solid(palette.header)
    cell.alignment = {
      vertical: "middle",
      horizontal: ALIGN[column.kind],
      wrapText: true
    }
    widen(sheet, index + 1, column.kind, column.header.length + 1)
  })
  sheet.getRow(headerRow).height = 20

  // Filas alternas en blanco y gris muy claro
  if (rows.length === 0) {
    const cell = sheet.getCell(firstRow, 1)
    cell.value = emptyText ?? "Sin registros"
    cell.font = { italic: true, color: { argb: COLORS.muted } }
    cell.alignment = { vertical: "middle", horizontal: "center" }
    if (width > 1) sheet.mergeCellsWithoutStyle(firstRow, 1, firstRow, width)
    sheet.getRow(firstRow).height = 20
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
      cell.alignment = { vertical: "middle", horizontal: ALIGN[column.kind] }
      if (rowIndex % 2 === 1) cell.fill = solid(COLORS.zebra)

      const tone = column.tone?.(row)
      cell.font = { color: { argb: tone ? TONE_COLORS[tone] : COLORS.ink } }

      widen(sheet, index + 1, column.kind, displayLength(value, column.kind))
    })
  })

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
    totalRow,
    nextRow: bottomRow + 2,
    columnLetters: letters,
    range: (key) => `${letters[key]}${firstRow}:${letters[key]}${lastRow}`,
    totalCell: (key) => `${letters[key]}${lastRow + 1}`,
    values
  }

  // Fila de total con su tinte y texto oscuro en negrita
  if (total && totalRow) {
    columns.forEach((column, index) => {
      const cell = sheet.getCell(totalRow, index + 1)
      cell.font = { bold: true, color: { argb: COLORS.ink } }
      cell.fill = solid(palette.total)
      cell.alignment = { vertical: "middle", horizontal: ALIGN[column.kind] }

      const spec = total.cells[column.key]
      if (index === 0 && !spec) {
        cell.value = total.label
        cell.alignment = { vertical: "middle", horizontal: "left" }
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
    sheet.getRow(totalRow).height = 20
  }

  // Bordes al final: combinar celdas copia el estilo de la primera a las
  // demás, así que el marco se pinta cuando ya están combinadas
  frame(
    sheet,
    palette,
    titleRow,
    bottomRow,
    width,
    new Set(totalRow ? [totalRow] : [])
  )

  return ranges
}
