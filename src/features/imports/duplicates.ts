import { normalizeText } from "./detect"
import type {
  DebtEntryKind,
  DebtEntryValue,
  GoalContributionValue,
  PreviewRow,
  RecurringValue,
  TransactionType
} from "./types"

// Duplicados (SPEC 08): misma fecha, tipo, monto y descripción normalizada.
// SPEC 08b: una clave propia por destino.

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

/** Gasto fijo: nombre normalizado */
export function recurringDuplicateKey(value: Pick<RecurringValue, "name">) {
  return normalizeText(value.name)
}

/** Pago o ajuste: deuda, tipo, monto con signo y fecha */
export function debtEntryDuplicateKey(value: {
  debtId: string
  kind: DebtEntryKind
  amount: number
  occurred_on: string
}) {
  return [
    value.debtId,
    value.kind,
    value.amount.toFixed(2),
    value.occurred_on
  ].join("|")
}

/** Aporte o retiro: meta, monto con signo y fecha */
export function goalContributionDuplicateKey(value: {
  goalId: string
  amount: number
  occurred_on: string
}) {
  return [value.goalId, value.amount.toFixed(2), value.occurred_on].join("|")
}

/** Rango [min, max] de fechas de las filas con datos, o null */
export function dateRange(rows: PreviewRow<{ occurred_on: string }>[]) {
  const dates = rows.flatMap((row) =>
    row.value ? [row.value.occurred_on] : []
  )
  if (dates.length === 0) return null
  dates.sort()
  return { from: dates[0], to: dates[dates.length - 1] }
}

/**
 * Marca como duplicadas (y desmarca) las filas listas cuya clave coincide con
 * una de `stored` (clave → motivo) o con una fila anterior del mismo archivo.
 * Las demás filas no cambian.
 */
export function markDuplicatesBy<V>(
  rows: PreviewRow<V>[],
  stored: Map<string, string>,
  keyOf: (value: V) => string
): PreviewRow<V>[] {
  const seen = new Map<string, PreviewRow<V>>()

  return rows.map((row) => {
    if (row.status !== "ready" || !row.value) return row

    const key = keyOf(row.value)
    const storedReason = stored.get(key)
    const previous = seen.get(key)

    if (!previous) seen.set(key, row)

    const reason =
      storedReason ??
      (previous
        ? `Posible duplicado de la fila ${previous.sourceRow} (${previous.sheet})`
        : null)

    if (!reason) return row

    return {
      ...row,
      status: "duplicate",
      selected: false,
      reasons: [...row.reasons, reason]
    }
  })
}

/** Movimientos: duplicados contra los movimientos existentes */
export function markDuplicates(
  rows: PreviewRow[],
  existing: DuplicateCandidate[]
): PreviewRow[] {
  const stored = new Map<string, string>()
  for (const candidate of existing) {
    const key = duplicateKey(candidate)
    if (!stored.has(key)) {
      stored.set(
        key,
        `Posible duplicado de un movimiento del ${displayDate(candidate.occurred_on)}`
      )
    }
  }
  return markDuplicatesBy(rows, stored, duplicateKey)
}

/** Gastos fijos: duplicados contra todos los gastos fijos del espacio */
export function markRecurringDuplicates(
  rows: PreviewRow<RecurringValue>[],
  existing: { name: string }[]
) {
  const stored = new Map<string, string>()
  for (const candidate of existing) {
    const key = recurringDuplicateKey(candidate)
    if (!stored.has(key)) {
      stored.set(key, `Posible duplicado del gasto fijo «${candidate.name}»`)
    }
  }
  return markDuplicatesBy(rows, stored, recurringDuplicateKey)
}

/** Deudas: duplicados contra los pagos y ajustes existentes */
export function markDebtEntryDuplicates(
  rows: PreviewRow<DebtEntryValue>[],
  existing: {
    debtId: string
    kind: DebtEntryKind
    amount: number
    occurred_on: string
  }[]
) {
  const stored = new Map<string, string>()
  for (const candidate of existing) {
    const key = debtEntryDuplicateKey(candidate)
    if (!stored.has(key)) {
      stored.set(
        key,
        `Posible duplicado de un pago o ajuste del ${displayDate(candidate.occurred_on)}`
      )
    }
  }
  return markDuplicatesBy(rows, stored, debtEntryDuplicateKey)
}

/** Metas: duplicados contra los aportes y retiros existentes */
export function markGoalContributionDuplicates(
  rows: PreviewRow<GoalContributionValue>[],
  existing: { goalId: string; amount: number; occurred_on: string }[]
) {
  const stored = new Map<string, string>()
  for (const candidate of existing) {
    const key = goalContributionDuplicateKey(candidate)
    if (!stored.has(key)) {
      stored.set(
        key,
        `Posible duplicado de un aporte o retiro del ${displayDate(candidate.occurred_on)}`
      )
    }
  }
  return markDuplicatesBy(rows, stored, goalContributionDuplicateKey)
}
