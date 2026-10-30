import { todayISO } from "@/libs/dates"
import { GOAL_ENTRY_VALUE_SYNONYMS, MAX_ENTRY_NOTE_LENGTH } from "./constants"
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
  GoalContributionValue,
  GoalEntryTarget,
  ImportConfig,
  LinkTarget,
  PreviewRow
} from "./types"

// Normalización de aportes y retiros de metas (SPEC 08b). Funciones puras:
// `today` se inyecta. Fechas y montos siguen las reglas del SPEC 08.

type EntryKind = Exclude<GoalEntryTarget, "skip">

/** Fila de meta ya leída, antes de mapear la columna de meta */
export interface ExtractedGoalContributionRow {
  sheet: string
  sourceRow: number
  status: "ready" | "error" | "skipped"
  reasons: string[]
  value?: {
    entry: EntryKind
    amount: number // siempre > 0; el signo lo pone `entry`
    occurred_on: string
    /** Valor normalizado de la columna `goal`; null con meta fija */
    linkKey: string | null
    linkLabel: string
    note: string | null
  }
}

/** Destino sugerido para un valor de la columna de tipo */
export function suggestGoalEntryValue(value: string) {
  return suggestBySynonyms<GoalEntryTarget>(value, GOAL_ENTRY_VALUE_SYNONYMS)
}

/** Lee y valida cada fila con el mapeo de columnas y de tipo */
export function extractGoalContributionRows(
  tables: SourceTable[],
  config: ImportConfig,
  today = todayISO()
) {
  const { mapping, dateFormat, entryTypeMode, entryTypeValues } = config
  const { rows: dataRows, empty } = readDataRows(tables, mapping, [
    "date",
    "amount"
  ])
  const rows: ExtractedGoalContributionRow[] = []

  for (const { sheet, sourceRow, at } of dataRows) {
    const base = { sheet, sourceRow }
    const reasons: string[] = []
    const signed = parseAmountCell(at("amount"))

    // Tipo: valores de la columna, signo o todos son aportes
    let entry: EntryKind | undefined
    if (entryTypeMode === "column") {
      const raw = cellText(at("entry_type"))
      const target = entryTypeValues[normalizeText(raw)] as
        GoalEntryTarget | undefined
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
        entry = signed < 0 ? "withdrawal" : "contribution"
      }
    } else {
      entry = "contribution"
    }

    const occurredOn = parseDateCell(at("date"), dateFormat, today)
    if (!occurredOn) reasons.push("Fecha inválida")
    else if (occurredOn > today) reasons.push("Fecha futura")

    const amount = Math.abs(signed)
    if (!isValidAmount(amount)) reasons.push("Monto inválido")

    const link =
      mapping.goal === undefined
        ? { key: null, label: "" }
        : linkValue(at("goal"))

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
 * Asigna la meta de cada fila (la fija o la del valor de la columna) y deja
 * las filas listas para la vista previa.
 */
export function buildGoalContributionPreviewRows(
  rows: ExtractedGoalContributionRow[],
  links: Record<string, LinkTarget>,
  fixedGoalId: string | null
): PreviewRow<GoalContributionValue>[] {
  return rows.map((row): PreviewRow<GoalContributionValue> => {
    const { sheet, sourceRow, status, reasons } = row
    if (!row.value)
      return { sheet, sourceRow, status, reasons, selected: false }

    const { entry, amount, occurred_on, linkKey, linkLabel, note } = row.value
    const target: LinkTarget =
      linkKey === null
        ? fixedGoalId
          ? { kind: "existing", id: fixedGoalId }
          : { kind: "skip" }
        : (links[linkKey] ?? { kind: "skip" })

    if (target.kind === "skip") {
      return {
        sheet,
        sourceRow,
        status: "skipped",
        reasons: [`Meta «${linkLabel}» marcada como No importar`],
        selected: false
      }
    }

    return {
      ...row,
      selected: true,
      value: {
        goalId: target.id,
        amount: entry === "withdrawal" ? -amount : amount,
        occurred_on,
        note
      }
    }
  })
}
