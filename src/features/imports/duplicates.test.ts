import { describe, expect, it } from "vitest"
import {
  dateRange,
  debtEntryDuplicateKey,
  duplicateKey,
  goalContributionDuplicateKey,
  markDebtEntryDuplicates,
  markDuplicates,
  markGoalContributionDuplicates,
  markRecurringDuplicates,
  recurringDuplicateKey
} from "./duplicates"
import type {
  DebtEntryValue,
  GoalContributionValue,
  PreviewRow,
  RecurringValue,
  TransactionValue
} from "./types"

function preview<V>(
  value: V | undefined,
  fields: Partial<PreviewRow<V>> = {}
): PreviewRow<V> {
  return {
    sheet: "Hoja1",
    sourceRow: 2,
    status: value ? "ready" : "error",
    reasons: [],
    selected: Boolean(value),
    value,
    ...fields
  }
}

const tx = (fields: Partial<TransactionValue> = {}): TransactionValue => ({
  type: "expense",
  amount: 50_000,
  occurred_on: "2026-10-05",
  categoryKey: "existing:c1",
  accountKey: null,
  description: "Mercado",
  note: null,
  ...fields
})

describe("claves", () => {
  it("movimiento: fecha, tipo, monto y descripción normalizada", () => {
    expect(duplicateKey(tx({ description: "  MERCÁDO " }))).toBe(
      "2026-10-05|expense|50000.00|mercado"
    )
  })

  it("gasto fijo, deuda y meta", () => {
    expect(recurringDuplicateKey({ name: "Netflíx" })).toBe("netflix")
    expect(
      debtEntryDuplicateKey({
        debtId: "d1",
        kind: "adjustment",
        amount: -10,
        occurred_on: "2026-10-05"
      })
    ).toBe("d1|adjustment|-10.00|2026-10-05")
    expect(
      goalContributionDuplicateKey({
        goalId: "g1",
        amount: 5.5,
        occurred_on: "2026-10-05"
      })
    ).toBe("g1|5.50|2026-10-05")
  })
})

describe("dateRange", () => {
  it("menor y mayor fecha de las filas con datos", () => {
    expect(
      dateRange([
        preview(tx({ occurred_on: "2026-10-09" })),
        preview<TransactionValue>(undefined),
        preview(tx({ occurred_on: "2026-10-01" }))
      ])
    ).toEqual({ from: "2026-10-01", to: "2026-10-09" })
    expect(dateRange([])).toBeNull()
  })
})

describe("markDuplicates", () => {
  const rows = [
    preview(tx(), { sourceRow: 2 }),
    preview(tx({ description: "mercado" }), { sourceRow: 3 }),
    preview(tx({ occurred_on: "2026-10-06" }), { sourceRow: 4 }),
    preview(tx({ occurred_on: "2026-10-07" }), {
      sourceRow: 5,
      reasons: ["aviso"]
    }),
    preview<TransactionValue>(undefined, { sourceRow: 6 })
  ]
  const marked = markDuplicates(rows, [
    {
      occurred_on: "2026-10-07",
      type: "expense",
      amount: 50_000,
      description: "Mercado"
    }
  ])

  it("contra otra fila del mismo archivo", () => {
    expect(marked[0]).toBe(rows[0])
    expect(marked[1]).toMatchObject({
      status: "duplicate",
      selected: false,
      reasons: ["Posible duplicado de la fila 2 (Hoja1)"]
    })
    expect(marked[2]).toBe(rows[2])
  })

  it("contra un movimiento guardado, conservando los avisos", () => {
    expect(marked[3]).toMatchObject({
      status: "duplicate",
      reasons: ["aviso", "Posible duplicado de un movimiento del 07/10/2026"]
    })
    expect(marked[4]).toBe(rows[4])
  })
})

describe("marcas por destino", () => {
  it("gastos fijos por nombre", () => {
    const value = { name: "netflix" } as RecurringValue
    expect(
      markRecurringDuplicates([preview(value)], [{ name: "Netflix" }])[0]
        .reasons
    ).toEqual(["Posible duplicado del gasto fijo «Netflix»"])
  })

  it("pagos de deuda", () => {
    const value: DebtEntryValue = {
      debtId: "d1",
      kind: "payment",
      amount: 100,
      occurred_on: "2026-10-05",
      note: null
    }
    expect(
      markDebtEntryDuplicates([preview(value)], [value])[0].reasons
    ).toEqual(["Posible duplicado de un pago o ajuste del 05/10/2026"])
  })

  it("aportes a metas", () => {
    const value: GoalContributionValue = {
      goalId: "g1",
      amount: 100,
      occurred_on: "2026-10-05",
      note: null
    }
    expect(
      markGoalContributionDuplicates([preview(value)], [value])[0].reasons
    ).toEqual(["Posible duplicado de un aporte o retiro del 05/10/2026"])
  })
})
