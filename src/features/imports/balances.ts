import type { DebtEntryValue, GoalContributionValue, PreviewRow } from "./types"

// Saldos resultantes de deudas y metas en la vista previa (SPEC 08b). Solo
// cuentan las filas marcadas.

export interface ResultingBalance {
  id: string
  name: string
  current: number
  result: number
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100
}

function resultingBalances<V>(
  rows: PreviewRow<V>[],
  items: { id: string; name: string; balance: number }[],
  idOf: (value: V) => string,
  deltaOf: (value: V) => number
): ResultingBalance[] {
  const deltas = new Map<string, number>()

  for (const row of rows) {
    if (!row.selected || !row.value) continue
    const id = idOf(row.value)
    deltas.set(id, (deltas.get(id) ?? 0) + deltaOf(row.value))
  }

  return items.flatMap(({ id, name, balance }) => {
    const delta = deltas.get(id)
    if (delta === undefined) return []
    return [
      { id, name, current: balance, result: roundAmount(balance + delta) }
    ]
  })
}

/** Deudas con filas marcadas: saldo actual → saldo + cargos − pagos − bajas */
export function debtResultingBalances(
  rows: PreviewRow<DebtEntryValue>[],
  debts: { id: string; name: string; balance: number }[]
) {
  return resultingBalances(
    rows,
    debts,
    (value) => value.debtId,
    (value) => (value.kind === "payment" ? -value.amount : value.amount)
  )
}

/** Metas con filas marcadas: ahorrado actual → ahorrado + aportes − retiros */
export function goalResultingBalances(
  rows: PreviewRow<GoalContributionValue>[],
  goals: { id: string; name: string; saved: number }[]
) {
  return resultingBalances(
    rows,
    goals.map(({ id, name, saved }) => ({ id, name, balance: saved })),
    (value) => value.goalId,
    (value) => value.amount
  )
}

/** Primer saldo que quedaría negativo, o null */
export function firstNegativeBalance(balances: ResultingBalance[]) {
  return balances.find((balance) => balance.result < 0) ?? null
}
