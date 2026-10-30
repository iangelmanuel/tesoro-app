import { MAX_AMOUNT, parseAmount } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import {
  DEFAULT_CATEGORY_NAMES,
  EMPTY_CATEGORY_LABEL,
  EXCEL_SERIAL_MAX,
  EXCEL_SERIAL_MIN,
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_NOTE_LENGTH,
  MIN_DATE,
  TYPE_VALUE_SYNONYMS
} from "./constants"
import {
  cellText,
  isEmptyCell,
  normalizeText,
  tableBodyRows,
  tableRowCells
} from "./detect"
import type {
  AccountOption,
  AccountTarget,
  AccountValue,
  CategoryOption,
  CategoryPair,
  CategoryTarget,
  DateFormat,
  DetectedTable,
  ImportConfig,
  ImportField,
  ImportStats,
  LinkTarget,
  PreviewRow,
  TransactionType,
  TypeValueTarget
} from "./types"

// Normalización por fila (SPEC 08). Funciones puras: `today` se inyecta.

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

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Monto con signo de una celda, o NaN. Texto con coma y punto: el último
 * separador es el decimal. Con uno solo, se lee como es-CO (`parseAmount`).
 * El signo puede venir como "-50.000", "50.000-" o "(50.000)".
 */
export function parseAmountCell(cell: unknown) {
  if (typeof cell === "number") {
    return Number.isFinite(cell) ? roundAmount(cell) : Number.NaN
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
  return sign * roundAmount(Number(normalized))
}

export function isValidAmount(value: number) {
  return !Number.isNaN(value) && value > 0 && value <= MAX_AMOUNT
}

/** Destino sugerido para un valor de la columna de tipo */
export function suggestTypeValue(value: string): TypeValueTarget | undefined {
  const normalized = normalizeText(value)
  if (TYPE_VALUE_SYNONYMS.income.includes(normalized)) return "income"
  if (TYPE_VALUE_SYNONYMS.expense.includes(normalized)) return "expense"
  return undefined
}

export interface SourceTable {
  table: DetectedTable
  cells: unknown[][]
}

/** Fila de datos ya leída, antes de mapear categorías */
export interface ExtractedRow {
  sheet: string
  sourceRow: number
  status: "ready" | "error" | "skipped"
  reasons: string[]
  value?: {
    type: TransactionType
    amount: number
    occurred_on: string
    /** Clave del par (tipo, valor de categoría de origen) */
    pairKey: string
    categoryLabel: string
    description: string
    note: string | null
    /** Valor de la columna Método; null si no está mapeada */
    accountLabel: string | null
  }
}

export interface ExtractResult {
  rows: ExtractedRow[]
  /** Filas sin fecha ni monto: no se muestran y suman en omitidas */
  empty: number
}

export function pairKey(type: TransactionType, label: string) {
  return `${type}:${normalizeText(label)}`
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

/** Número de filas con datos (con fecha o monto) en las tablas elegidas */
export function countDataRows(tables: SourceTable[], config: ImportConfig) {
  const { rows } = extractRows(tables, config)
  return rows.length
}

/** Lee y valida cada fila con el mapeo de columnas y tipo */
export function extractRows(
  tables: SourceTable[],
  config: ImportConfig,
  today = todayISO()
): ExtractResult {
  const { mapping, typeMode, dateFormat, typeValues } = config
  const rows: ExtractedRow[] = []
  let empty = 0

  for (const { table, cells } of tables) {
    for (const row of tableBodyRows(cells, table)) {
      const values = tableRowCells(cells, table, row)
      const at = (field: ImportField) => {
        const index = mapping[field]
        return index === undefined ? null : (values[index] ?? null)
      }

      const amountCells =
        typeMode === "split"
          ? [at("income_amount"), at("expense_amount")]
          : [at("amount")]

      if (isEmptyCell(at("date")) && amountCells.every(isEmptyCell)) {
        empty++
        continue
      }

      const base = { sheet: table.sheet, sourceRow: row + 1 }
      const reasons: string[] = []

      // Tipo y monto
      let type: TransactionType | undefined
      let amount = Number.NaN

      if (typeMode === "column") {
        const raw = cellText(at("type"))
        const target = typeValues[normalizeText(raw)]
        if (target === "skip") {
          rows.push({
            ...base,
            status: "skipped",
            reasons: [`Tipo «${raw || "(vacío)"}» marcado como Omitir fila`]
          })
          continue
        }
        if (target) {
          type = target
        } else {
          reasons.push("Tipo desconocido")
        }
        amount = Math.abs(parseAmountCell(at("amount")))
      } else if (typeMode === "sign") {
        const signed = parseAmountCell(at("amount"))
        if (!Number.isNaN(signed) && signed !== 0) {
          type = signed < 0 ? "expense" : "income"
        }
        amount = Math.abs(signed)
      } else {
        const income = isEmptyCell(at("income_amount"))
          ? 0
          : Math.abs(parseAmountCell(at("income_amount")))
        const expense = isEmptyCell(at("expense_amount"))
          ? 0
          : Math.abs(parseAmountCell(at("expense_amount")))

        if (income > 0 && expense > 0) {
          reasons.push("Ingreso y gasto a la vez")
        } else if (income > 0 || Number.isNaN(income)) {
          type = "income"
          amount = income
        } else if (expense > 0 || Number.isNaN(expense)) {
          type = "expense"
          amount = expense
        }
      }

      const occurredOn = parseDateCell(at("date"), dateFormat, today)
      if (!occurredOn) reasons.push("Fecha inválida")

      if (
        !reasons.includes("Ingreso y gasto a la vez") &&
        !isValidAmount(amount)
      ) {
        reasons.push("Monto inválido")
      }

      // Categoría de origen: sin columna, la del sistema por defecto
      const categoryLabel =
        mapping.category === undefined
          ? type
            ? DEFAULT_CATEGORY_NAMES[type]
            : ""
          : cellText(at("category")) || EMPTY_CATEGORY_LABEL

      // Descripción: vacía → valor de categoría de origen
      let description = cellText(at("description"))
      if (!description && mapping.category !== undefined) {
        description = cellText(at("category"))
      }
      if (!description) {
        reasons.push("Falta la descripción")
      } else if (description.length > MAX_DESCRIPTION_LENGTH) {
        description = description.slice(0, MAX_DESCRIPTION_LENGTH).trim()
      }

      const note = cellText(at("note")).slice(0, MAX_NOTE_LENGTH).trim() || null
      const accountLabel =
        mapping.account === undefined ? null : cellText(at("account"))

      if (reasons.length > 0 || !type || !occurredOn) {
        rows.push({ ...base, status: "error", reasons })
        continue
      }

      rows.push({
        ...base,
        status: "ready",
        reasons:
          cellText(at("description")).length > MAX_DESCRIPTION_LENGTH
            ? [`Descripción recortada a ${MAX_DESCRIPTION_LENGTH} caracteres`]
            : [],
        value: {
          type,
          amount,
          occurred_on: occurredOn,
          pairKey: pairKey(type, categoryLabel),
          categoryLabel,
          description,
          note,
          accountLabel
        }
      })
    }
  }

  return { rows, empty }
}

/** Valores distintos de la columna Método en las filas válidas */
export function accountValues(
  rows: { value?: { accountLabel: string | null } }[]
): AccountValue[] {
  const values = new Map<string, AccountValue>()

  for (const { value } of rows) {
    if (!value || value.accountLabel === null) continue
    const key = normalizeText(value.accountLabel)
    const entry = values.get(key) ?? {
      key,
      label: value.accountLabel,
      count: 0
    }
    entry.count++
    values.set(key, entry)
  }

  return [...values.values()]
}

/**
 * Cuenta sugerida para cada valor de Método: la activa con el mismo nombre
 * normalizado o una nueva con el valor. Vacío → sin cuenta.
 */
export function suggestAccountTargets(
  values: AccountValue[],
  accounts: AccountOption[]
): Record<string, AccountTarget> {
  return Object.fromEntries(
    values.map((value) => {
      const name = value.label.slice(0, MAX_ACCOUNT_NAME_LENGTH).trim()
      if (!name) return [value.key, { kind: "none" }]

      const existing = accounts.find(
        (account) => normalizeText(account.name) === normalizeText(name)
      )
      const target: AccountTarget = existing
        ? { kind: "existing", accountId: existing.id }
        : { kind: "new", name }
      return [value.key, target]
    })
  )
}

/** Clave de una cuenta nueva; dos valores con el mismo nombre la comparten */
export function newAccountKey(name: string) {
  return `new:${normalizeText(name)}`
}

export function existingAccountKey(accountId: string) {
  return `existing:${accountId}`
}

function accountKeyFor(target: AccountTarget | undefined) {
  if (!target || target.kind === "none") return null
  return target.kind === "existing"
    ? existingAccountKey(target.accountId)
    : newAccountKey(target.name)
}

/** Cuentas nuevas que usan las filas marcadas, sin repetir */
export function newAccounts(
  rows: PreviewRow<{ accountKey: string | null }>[],
  targets: Record<string, AccountTarget>
) {
  const used = new Set(
    rows.filter((row) => row.selected).map((row) => row.value?.accountKey)
  )
  const result = new Map<string, { key: string; name: string }>()

  for (const target of Object.values(targets)) {
    if (target.kind !== "new") continue
    const key = newAccountKey(target.name)
    if (used.has(key)) result.set(key, { key, name: target.name })
  }

  return [...result.values()]
}

/** Pares (tipo, valor de categoría de origen) de las filas válidas */
export function categoryPairs(
  rows: {
    value?: { type: TransactionType; pairKey: string; categoryLabel: string }
  }[]
): CategoryPair[] {
  const pairs = new Map<string, CategoryPair>()

  for (const { value } of rows) {
    if (!value) continue
    const pair = pairs.get(value.pairKey) ?? {
      key: value.pairKey,
      type: value.type,
      label: value.categoryLabel,
      count: 0
    }
    pair.count++
    pairs.set(value.pairKey, pair)
  }

  return [...pairs.values()]
}

/**
 * Destino sugerido para cada par: la categoría del mismo tipo con ese nombre
 * (sin distinguir mayúsculas ni tildes) o una nueva con el valor de origen.
 */
export function suggestCategoryTargets(
  pairs: CategoryPair[],
  categories: CategoryOption[]
): Record<string, CategoryTarget> {
  return Object.fromEntries(
    pairs.map((pair) => {
      const name = pair.label.slice(0, MAX_CATEGORY_NAME_LENGTH).trim()
      const existing = categories.find(
        (category) =>
          category.type === pair.type &&
          normalizeText(category.name) === normalizeText(name)
      )
      const target: CategoryTarget = existing
        ? { kind: "existing", categoryId: existing.id }
        : { kind: "new", name }
      return [pair.key, target]
    })
  )
}

/** Clave de destino de una categoría nueva; dos pares con el mismo nombre la comparten */
export function newCategoryKey(type: TransactionType, name: string) {
  return `new:${type}:${normalizeText(name)}`
}

export function existingCategoryKey(categoryId: string) {
  return `existing:${categoryId}`
}

/**
 * Aplica el mapeo de categorías y de cuentas y deja las filas listas para la
 * vista previa. La cuenta nunca omite filas.
 */
export function buildPreviewRows(
  rows: ExtractedRow[],
  targets: Record<string, CategoryTarget>,
  accountTargets: Record<string, AccountTarget> = {}
): PreviewRow[] {
  return rows.map((row): PreviewRow => {
    if (!row.value) {
      const { sheet, sourceRow, status, reasons } = row
      return { sheet, sourceRow, status, reasons, selected: false }
    }

    const { pairKey: key, categoryLabel, accountLabel, ...value } = row.value
    const target = targets[key] ?? { kind: "skip" }

    if (target.kind === "skip") {
      return {
        sheet: row.sheet,
        sourceRow: row.sourceRow,
        status: "skipped",
        reasons: [`Categoría «${categoryLabel}» marcada como No importar`],
        selected: false
      }
    }

    return {
      ...row,
      selected: true,
      value: {
        ...value,
        categoryKey:
          target.kind === "existing"
            ? existingCategoryKey(target.categoryId)
            : newCategoryKey(value.type, target.name),
        accountKey:
          accountLabel === null
            ? null
            : accountKeyFor(accountTargets[normalizeText(accountLabel)])
      }
    }
  })
}

/** Categorías nuevas que usan las filas marcadas, sin repetir */
export function newCategories(
  rows: PreviewRow<{ categoryKey: string }>[],
  targets: Record<string, CategoryTarget>,
  pairs: CategoryPair[]
) {
  const used = new Set(
    rows.filter((row) => row.selected).map((row) => row.value?.categoryKey)
  )
  const result = new Map<
    string,
    { key: string; type: TransactionType; name: string }
  >()

  for (const pair of pairs) {
    const target = targets[pair.key]
    if (target?.kind !== "new") continue
    const key = newCategoryKey(pair.type, target.name)
    if (used.has(key))
      result.set(key, { key, type: pair.type, name: target.name })
  }

  return [...result.values()]
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

/** Filas marcadas con `category_id` o `new_category_key`, para las RPC */
export function toImportRows<V extends { categoryKey: string }>(
  rows: PreviewRow<V>[]
) {
  return rows.flatMap((row) => {
    if (!row.selected || !row.value) return []
    const { categoryKey, ...value } = row.value
    const isExisting = categoryKey.startsWith("existing:")

    return [
      {
        ...value,
        category_id: isExisting ? categoryKey.slice("existing:".length) : null,
        new_category_key: isExisting ? null : categoryKey
      }
    ]
  })
}

/** Movimientos marcados para import_transactions, con su cuenta */
export function toTransactionImportRows<
  V extends { categoryKey: string; accountKey: string | null }
>(rows: PreviewRow<V>[]) {
  return toImportRows(rows).map(({ accountKey, ...row }) => {
    const accountId = accountKey?.startsWith("existing:")
      ? accountKey.slice("existing:".length)
      : null

    return {
      ...row,
      account_id: accountId,
      new_account_key:
        accountKey !== null && accountId === null ? accountKey : null
    }
  })
}

/** Categoría destino de un par ya mapeado, como clave para las RPC */
export function categoryKeyFor(
  target: CategoryTarget,
  type: TransactionType
): string | null {
  if (target.kind === "skip") return null
  return target.kind === "existing"
    ? existingCategoryKey(target.categoryId)
    : newCategoryKey(type, target.name)
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
