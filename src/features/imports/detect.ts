import {
  EXCEL_SERIAL_MAX,
  EXCEL_SERIAL_MIN,
  HEADER_SYNONYMS,
  MIN_HEADER_CELLS,
  TABLE_END_EMPTY_ROWS
} from "./constants"
import type {
  ColumnMapping,
  DetectedTable,
  ImportField,
  TypeMode
} from "./types"

// Funciones puras sobre la matriz de celdas de una hoja (SPEC 08)

/** Minúsculas, sin tildes, sin espacios a los lados y con los internos colapsados */
export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

export function isEmptyCell(cell: unknown) {
  return (
    cell === null ||
    cell === undefined ||
    (typeof cell === "string" && cell.trim() === "")
  )
}

const DATE_TEXT = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/
const NUMBER_TEXT = /^[-(]?\s*\$?\s*\d[\d.,\s]*\)?-?$/

function isDateLike(cell: unknown) {
  if (cell instanceof Date) return true
  if (typeof cell === "number") {
    return cell >= EXCEL_SERIAL_MIN && cell <= EXCEL_SERIAL_MAX
  }
  return typeof cell === "string" && DATE_TEXT.test(cell.trim())
}

function isNumberLike(cell: unknown) {
  if (typeof cell === "number") return Number.isFinite(cell)
  return typeof cell === "string" && NUMBER_TEXT.test(cell.trim())
}

function isTextCell(cell: unknown) {
  return (
    typeof cell === "string" &&
    !isEmptyCell(cell) &&
    !isNumberLike(cell) &&
    !isDateLike(cell)
  )
}

/** Texto de una celda para mostrarla o compararla */
export function cellText(cell: unknown) {
  if (isEmptyCell(cell)) return ""
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

function rowCells(cells: unknown[][], row: number, start: number, end: number) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => cells[row]?.[start + index] ?? null
  )
}

function isEmptyRange(
  cells: unknown[][],
  row: number,
  start: number,
  end: number
) {
  return rowCells(cells, row, start, end).every(isEmptyCell)
}

/** Última columna con datos de la hoja, o -1 si está vacía */
function lastColumn(cells: unknown[][]) {
  let last = -1
  for (const row of cells) {
    for (let col = row.length - 1; col > last; col--) {
      if (!isEmptyCell(row[col])) {
        last = col
        break
      }
    }
  }
  return last
}

/** Tramos contiguos de celdas no vacías de una fila */
function segments(row: unknown[]) {
  const result: { start: number; end: number }[] = []
  let start = -1

  for (let col = 0; col <= row.length; col++) {
    const filled = col < row.length && !isEmptyCell(row[col])
    if (filled && start === -1) start = col
    if (!filled && start !== -1) {
      result.push({ start, end: col - 1 })
      start = -1
    }
  }

  return result
}

function longestTextRun(cells: unknown[]) {
  let longest = 0
  let current = 0
  for (const cell of cells) {
    current = isTextCell(cell) ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

/** La fila tiene una celda tipo fecha y otra, distinta, tipo número */
function looksLikeDataRow(cells: unknown[]) {
  return cells.some(
    (cell, dateIndex) =>
      isDateLike(cell) &&
      cells.some((other, index) => index !== dateIndex && isNumberLike(other))
  )
}

/** Primera fila no vacía después de `row` dentro del rango, o -1 */
function nextFilledRow(
  cells: unknown[][],
  row: number,
  start: number,
  end: number
) {
  for (let next = row + 1; next < cells.length; next++) {
    if (!isEmptyRange(cells, next, start, end)) return next
  }
  return -1
}

/**
 * Filas de datos de una tabla (índice 0), sin las vacías intermedias. La
 * tabla termina con TABLE_END_EMPTY_ROWS filas vacías seguidas o con la hoja.
 */
export function tableBodyRows(cells: unknown[][], table: DetectedTable) {
  const rows: number[] = []
  let emptyStreak = 0

  for (let row = table.headerRow + 1; row < cells.length; row++) {
    if (isEmptyRange(cells, row, table.startCol, table.endCol)) {
      emptyStreak++
      if (emptyStreak >= TABLE_END_EMPTY_ROWS) break
      continue
    }
    emptyStreak = 0
    rows.push(row)
  }

  return rows
}

/** Celdas de una fila de datos, alineadas con los encabezados de la tabla */
export function tableRowCells(
  cells: unknown[][],
  table: DetectedTable,
  row: number
) {
  return rowCells(cells, row, table.startCol, table.endCol)
}

/**
 * Tabla con la fila de encabezados y el rango de columnas dados. La usa el
 * ajuste manual. Los encabezados vacíos pasan a "Columna N".
 */
export function buildTable(
  cells: unknown[][],
  sheet: string,
  headerRow: number,
  startCol: number,
  endCol: number
): DetectedTable {
  return {
    sheet,
    headerRow,
    startCol,
    endCol,
    headers: rowCells(cells, headerRow, startCol, endCol).map(
      (cell, index) =>
        cellText(cell) || `Columna ${columnName(startCol + index)}`
    )
  }
}

/** Letra de columna como en Excel: 0 → A, 8 → I, 26 → AA */
export function columnName(index: number) {
  let name = ""
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name
  }
  return name
}

/**
 * Tablas de una hoja. Una fila de encabezados tiene ≥ 3 celdas de texto
 * contiguas y la siguiente fila no vacía del rango trae una fecha y un
 * número. Una fila puede dar varias tablas si sus tramos están separados por
 * columnas vacías. Sin resultados, se usa la fila 1 con todas las columnas.
 */
export function detectTables(
  cells: unknown[][],
  sheet: string
): DetectedTable[] {
  const tables: DetectedTable[] = []
  // Celdas ya ocupadas por una tabla, para no detectar sus filas como otra
  const taken: { start: number; end: number; from: number; to: number }[] = []

  for (let row = 0; row < cells.length; row++) {
    for (const { start, end } of segments(cells[row] ?? [])) {
      const overlaps = taken.some(
        (area) =>
          row >= area.from &&
          row <= area.to &&
          start <= area.end &&
          end >= area.start
      )
      if (overlaps) continue

      if (longestTextRun(rowCells(cells, row, start, end)) < MIN_HEADER_CELLS) {
        continue
      }

      const next = nextFilledRow(cells, row, start, end)
      if (next === -1 || !looksLikeDataRow(rowCells(cells, next, start, end))) {
        continue
      }

      const table = buildTable(cells, sheet, row, start, end)
      const body = tableBodyRows(cells, table)
      tables.push(table)
      taken.push({ start, end, from: row, to: body.at(-1) ?? row })
    }
  }

  if (tables.length > 0) return tables

  const last = lastColumn(cells)
  return last === -1 ? [] : [buildTable(cells, sheet, 0, 0, last)]
}

function sameHeaders(a: string[], b: string[]) {
  return (
    a.length === b.length &&
    a.every(
      (header, index) => normalizeText(header) === normalizeText(b[index])
    )
  )
}

/**
 * Tabla de la hoja con los mismos encabezados normalizados que `reference`,
 * empiece en la columna que empiece. null si ninguna fila coincide.
 */
export function matchTable(
  cells: unknown[][],
  sheet: string,
  reference: DetectedTable
): DetectedTable | null {
  const width = reference.endCol - reference.startCol + 1

  for (let row = 0; row < cells.length; row++) {
    const length = cells[row]?.length ?? 0
    for (let start = 0; start + width <= length; start++) {
      const table = buildTable(cells, sheet, row, start, start + width - 1)
      if (sameHeaders(table.headers, reference.headers)) return table
    }
  }

  return null
}

/**
 * Mapeo sugerido por los encabezados. Cada campo toma el primer encabezado
 * que coincide y cada columna se usa una sola vez.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<number>()
  const normalized = headers.map(normalizeText)

  for (const field of Object.keys(HEADER_SYNONYMS) as ImportField[]) {
    const index = normalized.findIndex(
      (header, col) => !used.has(col) && HEADER_SYNONYMS[field].includes(header)
    )
    if (index !== -1) {
      mapping[field] = index
      used.add(index)
    }
  }

  // Con columna de tipo no hacen falta las de ingreso y gasto, y viceversa
  if (mapping.type !== undefined) {
    delete mapping.income_amount
    delete mapping.expense_amount
  }

  return mapping
}

export function suggestTypeMode(mapping: ColumnMapping): TypeMode {
  if (mapping.type !== undefined) return "column"
  if (
    mapping.income_amount !== undefined &&
    mapping.expense_amount !== undefined
  ) {
    return "split"
  }
  return "sign"
}
