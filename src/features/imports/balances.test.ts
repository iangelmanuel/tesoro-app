import { describe, expect, it } from "vitest"
import {
  debtResultingBalances,
  firstNegativeBalance,
  goalResultingBalances
} from "./balances"
import type { DebtEntryValue, GoalContributionValue, PreviewRow } from "./types"

function row<V>(value: V, selected = true): PreviewRow<V> {
  return {
    sheet: "Hoja1",
    sourceRow: 2,
    status: "ready",
    reasons: [],
    selected,
    value
  }
}

const debtEntry = (fields: Partial<DebtEntryValue>): DebtEntryValue => ({
  debtId: "d1",
  kind: "payment",
  amount: 100,
  occurred_on: "2026-10-05",
  note: null,
  ...fields
})

describe("debtResultingBalances", () => {
  it("pagos restan, ajustes suman con su signo; solo filas marcadas", () => {
    const balances = debtResultingBalances(
      [
        row(debtEntry({ amount: 300.1 })),
        row(debtEntry({ kind: "adjustment", amount: 50 })),
        row(debtEntry({ kind: "adjustment", amount: -20.2 })),
        row(debtEntry({ amount: 999 }), false)
      ],
      [
        { id: "d1", name: "Visa", balance: 1000 },
        { id: "d2", name: "Sin filas", balance: 10 }
      ]
    )
    expect(balances).toEqual([
      { id: "d1", name: "Visa", current: 1000, result: 729.7 }
    ])
  })
})

describe("goalResultingBalances y firstNegativeBalance", () => {
  const contribution = (amount: number): GoalContributionValue => ({
    goalId: "g1",
    amount,
    occurred_on: "2026-10-05",
    note: null
  })

  it("aportes suman y retiros restan", () => {
    const balances = goalResultingBalances(
      [row(contribution(100)), row(contribution(-250))],
      [{ id: "g1", name: "Viaje", saved: 100 }]
    )
    expect(balances).toEqual([
      { id: "g1", name: "Viaje", current: 100, result: -50 }
    ])
    expect(firstNegativeBalance(balances)).toEqual(balances[0])
  })

  it("sin saldos negativos da null", () => {
    expect(
      firstNegativeBalance([{ id: "x", name: "X", current: 0, result: 0 }])
    ).toBeNull()
  })
})
