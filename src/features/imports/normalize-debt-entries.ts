import { todayISO } from "@/libs/dates"
import { DEBT_ENTRY_VALUE_SYNONYMS, MAX_ENTRY_NOTE_LENGTH } from "./constants"
import { cellText, normalizeText } from "./detect"
import {
  type SourceTable,
  isValidAmount,
  linkValue,
  noteText,
  parseAmountCell,
  parseDateCell,
  readDataRows,
  suggestBySynonyms
} from "./normalize"
import type {
  DebtEntryTarget,
  DebtEntryValue,
  ImportConfig,
  LinkTarget,
  PreviewRow
} from "./types"

// Normalización de pagos y ajustes de deudas (SPEC 08b). Funciones puras:
// `today` se inyecta. Fechas y montos siguen las reglas del SPEC 08.

type EntryKind = Exclude<DebtEntryTarget, "skip">

/** Fila de deuda ya leída, antes de mapear la columna de deuda */
export interface ExtractedDebtEntryRow {
  sheet: string
  sourceRow: number
  status: "ready" | "error" | "skipped"
  reasons: string[]
  value?: {
    entry: EntryKind
    amount: number // siempre > 0; el signo lo pone `entry`
    occurred_on: string
    /** Valor normalizado de la columna `debt`; null con deuda fija */
    linkKey: string | null
    linkLabel: string
    note: string | null
  }
}

/** Destino sugerido para un valor de la columna de tipo */
export function suggestDebtEntryValue(value: string) {
  return suggestBySynonyms<DebtEntryTarget>(value, DEBT_ENTRY_VALUE_SYNONYMS)
}

/** Lee y valida cada fila con el mapeo de columnas y de tipo */
export function extractDebtEntryRows(
  tables: SourceTable[],
  config: ImportConfig,
  today = todayISO()
) {
  const { mapping, dateFormat, entryTypeMode, entryTypeValues } = config
  const { rows: dataRows, empty } = readDataRows(tables, mapping, [
    "date",
    "amount"
  ])
  const rows: ExtractedDebtEntryRow[] = []

  for (const { sheet, sourceRow, at } of dataRows) {
    const base = { sheet, sourceRow }
    const reasons: string[] = []
    const signed = parseAmountCell(at("amount"))

    // Tipo: valores de la columna, signo o todas son pagos
    let entry: EntryKind | undefined
    if (entryTypeMode === "column") {
      const raw = cellText(at("entry_type"))
      const target = entryTypeValues[normalizeText(raw)] as
        DebtEntryTarget | undefined
      if (target === "skip") {
        rows.push({
          ...base,
          status: "skipped",
          reasons: [`Tipo «${raw || "(vacío)"}» marcado como Omitir fila`]
        })
        continue
      }
      entry = target
      if (!entry) reasons.push("Tipo desconocido")
    } else if (entryTypeMode === "sign") {
      if (!Number.isNaN(signed) && signed !== 0) {
        entry = signed < 0 ? "payment" : "charge"
      }
    } else {
      entry = "payment"
    }

    const occurredOn = parseDateCell(at("date"), dateFormat, today)
    if (!occurredOn) reasons.push("Fecha inválida")
    else if (occurredOn > today) reasons.push("Fecha futura")

    const amount = Math.abs(signed)
    if (!isValidAmount(amount)) reasons.push("Monto inválido")

    const link =
      mapping.debt === undefined
        ? { key: null, label: "" }
        : linkValue(at("debt"))

    if (reasons.length > 0 || !entry || !occurredOn) {
      rows.push({ ...base, status: "error", reasons })
      continue
    }

    rows.push({
      ...base,
      status: "ready",
      reasons: [],
      value: {
        entry,
        amount,
        occurred_on: occurredOn,
        linkKey: link.key,
        linkLabel: link.label,
        note: noteText(at("note"), MAX_ENTRY_NOTE_LENGTH)
      }
    })
  }

  return { rows, empty }
}

/**
 * Asigna la deuda de cada fila (la fija o la del valor de la columna) y deja
 * las filas listas para la vista previa.
 */
export function buildDebtEntryPreviewRows(
  rows: ExtractedDebtEntryRow[],
  links: Record<string, LinkTarget>,
  fixedDebtId: string | null
): PreviewRow<DebtEntryValue>[] {
  return rows.map((row): PreviewRow<DebtEntryValue> => {
    const { sheet, sourceRow, status, reasons } = row
    if (!row.value)
      return { sheet, sourceRow, status, reasons, selected: false }

    const { entry, amount, occurred_on, linkKey, linkLabel, note } = row.value
    const target: LinkTarget =
      linkKey === null
        ? fixedDebtId
          ? { kind: "existing", id: fixedDebtId }
          : { kind: "skip" }
        : (links[linkKey] ?? { kind: "skip" })

    if (target.kind === "skip") {
      return {
        sheet,
        sourceRow,
        status: "skipped",
        reasons: [`Deuda «${linkLabel}» marcada como No importar`],
        selected: false
      }
    }

    return {
      ...row,
      selected: true,
      value: {
        debtId: target.id,
        kind: entry === "payment" ? "payment" : "adjustment",
        amount: entry === "decrease" ? -amount : amount,
        occurred_on,
        note
      }
    }
  })
}
