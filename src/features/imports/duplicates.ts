import { normalizeText } from "./detect"
import type { PreviewRow, TransactionType } from "./types"

// Duplicados (SPEC 08): misma fecha, tipo, monto y descripción normalizada

export interface DuplicateCandidate {
  occurred_on: string
  type: TransactionType
  amount: number
  description: string
}

export function duplicateKey(value: DuplicateCandidate) {
  return [
    value.occurred_on,
    value.type,
    value.amount.toFixed(2),
    normalizeText(value.description)
  ].join("|")
}

/** YYYY-MM-DD → DD/MM/AAAA */
function displayDate(iso: string) {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

/** Rango [min, max] de fechas de las filas con datos, o null */
export function dateRange(rows: PreviewRow[]) {
  const dates = rows.flatMap((row) =>
    row.value ? [row.value.occurred_on] : []
  )
  if (dates.length === 0) return null
  dates.sort()
  return { from: dates[0], to: dates[dates.length - 1] }
}

/**
 * Marca como duplicadas (y desmarca) las filas listas que coinciden con un
 * movimiento existente o con una fila anterior del mismo archivo. Las demás
 * filas no cambian.
 */
export function markDuplicates(
  rows: PreviewRow[],
  existing: DuplicateCandidate[]
): PreviewRow[] {
  const stored = new Map<string, string>()
  for (const candidate of existing) {
    const key = duplicateKey(candidate)
    if (!stored.has(key)) stored.set(key, candidate.occurred_on)
  }

  const seen = new Map<string, PreviewRow>()

  return rows.map((row) => {
    if (row.status !== "ready" || !row.value) return row

    const key = duplicateKey(row.value)
    const storedOn = stored.get(key)
    const previous = seen.get(key)

    if (!previous) seen.set(key, row)

    const reason = storedOn
      ? `Posible duplicado de un movimiento del ${displayDate(storedOn)}`
      : previous
        ? `Posible duplicado de la fila ${previous.sourceRow} (${previous.sheet})`
        : null

    if (!reason) return row

    return {
      ...row,
      status: "duplicate",
      selected: false,
      reasons: [...row.reasons, reason]
    }
  })
}
