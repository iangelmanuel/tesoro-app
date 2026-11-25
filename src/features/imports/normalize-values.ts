import { MAX_AMOUNT, parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import { roundCents } from "@/libs/money"
import { EXCEL_SERIAL_MAX, EXCEL_SERIAL_MIN, MIN_DATE } from "./constants"
import {
  cellText,
  isEmptyCell,
  normalizeText,
  tableBodyRows,
  tableRowCells
} from "./detect"
import type {
  DateFormat,
  DetectedTable,
  ImportConfig,
  ImportField,
  ImportStats,
  LinkTarget,
  PreviewRow
} from "./types"

// Normalización de valores sueltos (SPEC 08): fechas, montos, textos y la
// lectura de filas de las tablas, más las stats de la vista previa. La usan
// todos los destinos. Funciones puras: `today` se inyecta.

const DAY_MS = 24 * 60 * 60 * 1000
// Día 0 de la serie de Excel en el sistema 1900 (incluye el 29/02/1900 ficticio)
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function isoFromParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${year}-${pad(month)}-${pad(day)}`
}

// read-excel-file entrega las fechas a las 00:00 UTC: se leen sus
// componentes UTC para que el día no se corra en zonas con offset negativo
function isoFromUTCDate(date: Date) {
  return isoFromParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  )
}

const DATE_PARTS = /^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})(?:[\sT].*)?$/

function parseDateText(value: string, format: DateFormat) {
  const match = DATE_PARTS.exec(value.trim())
  if (!match) return null

  const [a, b, c] = match.slice(1).map(Number)
  const [day, month, year] =
    format === "dmy" ? [a, b, c] : format === "mdy" ? [b, a, c] : [c, b, a]

  return isoFromParts(year < 100 ? 2000 + year : year, month, day)
}

/** Último día aceptado: hoy + 1 año */
export function maxDate(today: string) {
  const [year, month, day] = today.split("-").map(Number)
  return isoFromParts(year + 1, month, day) ?? `${year + 1}-${pad(month)}-28`
}

/** Fecha de una celda como YYYY-MM-DD, o null si no es válida */
export function parseDateCell(
  cell: unknown,
  format: DateFormat,
  today = todayISO()
) {
  let iso: string | null = null

  if (cell instanceof Date) {
    iso = Number.isNaN(cell.getTime()) ? null : isoFromUTCDate(cell)
  } else if (typeof cell === "number") {
    if (cell >= EXCEL_SERIAL_MIN && cell <= EXCEL_SERIAL_MAX) {
      iso = isoFromUTCDate(new Date(EXCEL_EPOCH + Math.floor(cell) * DAY_MS))
    }
  } else if (typeof cell === "string") {
    iso = parseDateText(cell, format)
  }

  if (!iso || iso < MIN_DATE || iso > maxDate(today)) return null
  return iso
}

/**
 * Monto con signo de una celda, o NaN. Texto con coma y punto: el último
 * separador es el decimal. Con uno solo, se lee como es-CO (`parseAmount`).
 * El signo puede venir como "-50.000", "50.000-" o "(50.000)".
 */
export function parseAmountCell(cell: unknown) {
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? roundCents(cell) : Number.NaN
  }
  if (typeof cell !== "string") return Number.NaN

  let text = cell.replace(/[$\s]/g, "")
  let sign = 1

  if (/^\(.*\)$/.test(text)) {
    sign = -1
    text = text.slice(1, -1)
  }
  if (text.startsWith("-")) {
    sign = -sign
    text = text.slice(1)
  } else if (text.endsWith("-")) {
    sign = -sign
    text = text.slice(0, -1)
  }

  const lastComma = text.lastIndexOf(",")
  const lastDot = text.lastIndexOf(".")

  if (lastComma === -1 || lastDot === -1) {
    return sign * parseAmount(text)
  }

  const decimal = lastComma > lastDot ? "," : "."
  const thousands = decimal === "," ? "." : ","
  const normalized = text.split(thousands).join("").replace(decimal, ".")

  if (!/^\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  return sign * roundCents(Number(normalized))
}

/** Monto válido: positivo y dentro del tope de un movimiento */
export function isValidAmount(value: number) {
  return !Number.isNaN(value) && value > 0 && value <= MAX_AMOUNT
}

/** Una tabla de una hoja con sus celdas */
export interface SourceTable {
  table: DetectedTable
  cells: unknown[][]
}

/** Valores distintos de una columna en las tablas, con su número de filas */
export function distinctValues(tables: SourceTable[], column: number) {
  const counts = new Map<string, { label: string; count: number }>()

  for (const { table, cells } of tables) {
    for (const row of tableBodyRows(cells, table)) {
      const label = cellText(tableRowCells(cells, table, row)[column])
      const key = normalizeText(label)
      const entry = counts.get(key) ?? { label, count: 0 }
      entry.count++
      counts.set(key, entry)
    }
  }

  return [...counts.entries()].map(([key, entry]) => ({ key, ...entry }))
}

/** Fila de datos de una tabla, con acceso a la celda de cada campo */
export interface DataRow {
  sheet: string
  sourceRow: number
  /** Celda del campo, o null si no está mapeado */
  at: (field: ImportField) => unknown
}

/**
 * Recorre las filas de las tablas. Las que tienen vacíos todos los
 * `requiredAny` no se entregan y se cuentan en `empty`.
 */
export function readDataRows(
  tables: SourceTable[],
  mapping: ImportConfig["mapping"],
  requiredAny: ImportField[]
) {
  const rows: DataRow[] = []
  let empty = 0

  for (const { table, cells } of tables) {
    for (const row of tableBodyRows(cells, table)) {
      const values = tableRowCells(cells, table, row)
      const at = (field: ImportField) => {
        const index = mapping[field]
        return index === undefined ? null : (values[index] ?? null)
      }

      if (requiredAny.every((field) => isEmptyCell(at(field)))) {
        empty++
        continue
      }

      rows.push({ sheet: table.sheet, sourceRow: row + 1, at })
    }
  }

  return { rows, empty }
}

/** Número entero de una celda (número o texto), o NaN */
export function parseIntegerCell(cell: unknown) {
  const text = typeof cell === "number" ? String(cell) : cellText(cell)
  return /^\d+$/.test(text) ? Number(text) : Number.NaN
}

/** Nota opcional recortada a `max` caracteres */
export function noteText(cell: unknown, max: number) {
  return cellText(cell).slice(0, max).trim() || null
}

/** Destino sugerido para un valor según una tabla de sinónimos */
export function suggestBySynonyms<T extends string>(
  value: string,
  synonyms: Partial<Record<T, readonly string[]>>
): T | undefined {
  const normalized = normalizeText(value)
  return (Object.keys(synonyms) as T[]).find((target) =>
    synonyms[target]?.includes(normalized)
  )
}

/** Valor de la columna de deuda o meta cuando la celda está vacía */
export const EMPTY_LINK_LABEL = "(vacío)"

/** Valor de la columna de deuda o meta de una fila, con su clave */
export function linkValue(cell: unknown) {
  const label = cellText(cell) || EMPTY_LINK_LABEL
  return { key: normalizeText(label), label }
}

/** Valores distintos de la columna de deuda o meta, con su número de filas */
export function linkValues(
  rows: { value?: { linkKey: string | null; linkLabel: string } }[]
) {
  const values = new Map<
    string,
    { key: string; label: string; count: number }
  >()

  for (const { value } of rows) {
    if (!value?.linkKey) continue
    const entry = values.get(value.linkKey) ?? {
      key: value.linkKey,
      label: value.linkLabel,
      count: 0
    }
    entry.count++
    values.set(value.linkKey, entry)
  }

  return [...values.values()]
}

/**
 * Deuda o meta sugerida para cada valor: la que tiene el mismo nombre
 * normalizado. Si no hay, "No importar".
 */
export function suggestLinkTargets(
  values: { key: string; label: string }[],
  options: { id: string; name: string }[]
): Record<string, LinkTarget> {
  return Object.fromEntries(
    values.map(({ key, label }) => {
      const match = options.find(
        (option) => normalizeText(option.name) === normalizeText(label)
      )
      const target: LinkTarget = match
        ? { kind: "existing", id: match.id }
        : { kind: "skip" }
      return [key, target]
    })
  )
}

/** Stats a partir de las filas de la vista previa y las vacías */
export function computeStats(
  rows: PreviewRow<unknown>[],
  empty: number
): ImportStats {
  const stats: ImportStats = {
    read: rows.length,
    imported: 0,
    skipped: empty,
    duplicates: 0,
    errors: 0
  }

  for (const row of rows) {
    if (row.selected) stats.imported++
    else if (row.status === "error") stats.errors++
    else if (row.status === "duplicate") stats.duplicates++
    else stats.skipped++
  }

  return stats
}
