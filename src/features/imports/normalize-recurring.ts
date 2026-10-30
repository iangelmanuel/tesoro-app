import { todayISO } from "@/libs/dates"
import {
  DEFAULT_CATEGORY_NAMES,
  EMPTY_CATEGORY_LABEL,
  FREQUENCY_VALUE_SYNONYMS,
  MAX_RECURRING_NAME_LENGTH,
  MONTH_NAMES
} from "./constants"
import { cellText, isEmptyCell, normalizeText } from "./detect"
import {
  type SourceTable,
  categoryKeyFor,
  isValidAmount,
  pairKey,
  parseAmountCell,
  parseDateCell,
  parseIntegerCell,
  readDataRows,
  suggestBySynonyms
} from "./normalize"
import type {
  CategoryTarget,
  FrequencyTarget,
  ImportConfig,
  PreviewRow,
  RecurringFrequency,
  RecurringValue
} from "./types"

// Normalización de gastos fijos (SPEC 08b). Funciones puras: `today` se
// inyecta. Fechas, montos y categorías siguen las reglas del SPEC 08.

/** Fila de gasto fijo ya leída, antes de mapear categorías */
export interface ExtractedRecurringRow {
  sheet: string
  sourceRow: number
  status: "ready" | "error" | "skipped"
  reasons: string[]
  value?: Omit<RecurringValue, "categoryKey"> & {
    type: "expense"
    /** Clave del par (gasto, valor de categoría de origen) */
    pairKey: string
    categoryLabel: string
  }
}

/** Destino sugerido para un valor de la columna de frecuencia */
export function suggestFrequencyValue(value: string) {
  return suggestBySynonyms<RecurringFrequency>(value, FREQUENCY_VALUE_SYNONYMS)
}

/** Mes de una celda: número 1–12 o nombre en español. NaN si no es válido */
export function parseMonthCell(cell: unknown) {
  const number = parseIntegerCell(cell)
  if (number >= 1 && number <= 12) return number

  const index = MONTH_NAMES.findIndex(
    (name) => name === normalizeText(cellText(cell))
  )
  return index === -1 ? Number.NaN : index + 1
}

/** Primer día del mes de `today` */
function firstDayOfMonth(today: string) {
  return `${today.slice(0, 7)}-01`
}

/** Lee y valida cada fila con el mapeo de columnas y de frecuencia */
export function extractRecurringRows(
  tables: SourceTable[],
  config: ImportConfig,
  today = todayISO()
) {
  const { mapping, dateFormat, frequencyValues } = config
  const { rows: dataRows, empty } = readDataRows(tables, mapping, [
    "name",
    "amount"
  ])
  const rows: ExtractedRecurringRow[] = []

  for (const { sheet, sourceRow, at } of dataRows) {
    const base = { sheet, sourceRow }
    const reasons: string[] = []
    const warnings: string[] = []

    // Frecuencia: sin columna, mensual
    let frequency: RecurringFrequency | undefined = "monthly"
    if (mapping.frequency !== undefined) {
      const raw = cellText(at("frequency"))
      const target: FrequencyTarget | undefined =
        frequencyValues[normalizeText(raw)]
      if (target === "skip") {
        rows.push({
          ...base,
          status: "skipped",
          reasons: [`Frecuencia «${raw || "(vacío)"}» marcada como Omitir fila`]
        })
        continue
      }
      frequency = target
      if (!frequency) reasons.push("Frecuencia desconocida")
    }

    // Nombre
    let name = cellText(at("name"))
    if (!name) {
      reasons.push("Falta el nombre")
    } else if (name.length > MAX_RECURRING_NAME_LENGTH) {
      name = name.slice(0, MAX_RECURRING_NAME_LENGTH).trim()
      warnings.push(
        `Nombre recortado a ${MAX_RECURRING_NAME_LENGTH} caracteres`
      )
    }

    // Monto
    const amount = Math.abs(parseAmountCell(at("amount")))
    if (!isValidAmount(amount)) reasons.push("Monto inválido")

    // Inicio: sin columna, primer día del mes actual
    const hasStartColumn = mapping.starts_on !== undefined
    const startsOn = hasStartColumn
      ? parseDateCell(at("starts_on"), dateFormat, today)
      : firstDayOfMonth(today)
    if (!startsOn) reasons.push("Fecha de inicio inválida")

    // Día: sin columna, el de la fecha de inicio
    let day = Number.NaN
    if (mapping.day_of_month !== undefined) {
      day = parseIntegerCell(at("day_of_month"))
      if (!(day >= 1 && day <= 31)) reasons.push("Día inválido")
    } else if (startsOn) {
      day = Number(startsOn.slice(8, 10))
    }

    // Mes: solo anual. Sin valor, el de la fecha de inicio de la columna
    let month: number | null = null
    if (frequency === "yearly") {
      const monthCell = at("month_of_year")
      if (!isEmptyCell(monthCell)) {
        month = parseMonthCell(monthCell)
        if (Number.isNaN(month)) reasons.push("Mes inválido")
      } else if (hasStartColumn && startsOn) {
        month = Number(startsOn.slice(5, 7))
      } else {
        reasons.push("Falta el mes")
      }
    }

    // Fin opcional, no antes del inicio
    let endsOn: string | null = null
    const endCell = at("ends_on")
    if (!isEmptyCell(endCell)) {
      endsOn = parseDateCell(endCell, dateFormat, today)
      if (!endsOn) reasons.push("Fecha de fin inválida")
      else if (startsOn && endsOn < startsOn) {
        reasons.push("El fin es antes del inicio")
      }
    }

    // Categoría de origen: sin columna, la del sistema por defecto
    const categoryLabel =
      mapping.category === undefined
        ? DEFAULT_CATEGORY_NAMES.expense
        : cellText(at("category")) || EMPTY_CATEGORY_LABEL

    if (reasons.length > 0 || !frequency || !startsOn) {
      rows.push({ ...base, status: "error", reasons })
      continue
    }

    rows.push({
      ...base,
      status: "ready",
      reasons: warnings,
      value: {
        type: "expense",
        name,
        amount,
        frequency,
        day_of_month: day,
        month_of_year: month,
        starts_on: startsOn,
        ends_on: endsOn,
        pairKey: pairKey("expense", categoryLabel),
        categoryLabel
      }
    })
  }

  return { rows, empty }
}

/** Aplica el mapeo de categorías y deja las filas listas para la vista previa */
export function buildRecurringPreviewRows(
  rows: ExtractedRecurringRow[],
  targets: Record<string, CategoryTarget>
): PreviewRow<RecurringValue>[] {
  return rows.map((row): PreviewRow<RecurringValue> => {
    const { sheet, sourceRow, status, reasons } = row
    if (!row.value)
      return { sheet, sourceRow, status, reasons, selected: false }

    const { type, pairKey: key, categoryLabel, ...value } = row.value
    const categoryKey = categoryKeyFor(targets[key] ?? { kind: "skip" }, type)

    if (!categoryKey) {
      return {
        sheet,
        sourceRow,
        status: "skipped",
        reasons: [`Categoría «${categoryLabel}» marcada como No importar`],
        selected: false
      }
    }

    return { ...row, selected: true, value: { ...value, categoryKey } }
  })
}
