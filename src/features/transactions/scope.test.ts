import { describe, expect, it } from "vitest"
import { previousTotalsOrNull, transactionsScope } from "./scope"

describe("previousTotalsOrNull", () => {
  it("devuelve los totales si hubo entradas o salidas", () => {
    const totals = { income: 0, expense: 50, balance: -50 }
    expect(previousTotalsOrNull(totals)).toBe(totals)
  })

  it("da null sin totales o con el mes en cero", () => {
    expect(previousTotalsOrNull(null)).toBeNull()
    expect(
      previousTotalsOrNull({ income: 0, expense: 0, balance: 0 })
    ).toBeNull()
  })
})

describe("transactionsScope", () => {
  it("nombra el mes con mayúscula inicial", () => {
    expect(transactionsScope({ month: "2026-11", page: 1 })).toBe(
      "Noviembre 2026"
    )
  })

  it("nombra todos los meses", () => {
    expect(transactionsScope({ month: "all", page: 1 })).toBe("Todos los meses")
  })

  it("avisa si hay filtros además del mes", () => {
    expect(transactionsScope({ month: "2026-11", page: 1, q: "café" })).toBe(
      "Noviembre 2026 · con filtros"
    )
    expect(
      transactionsScope({ month: "all", page: 2, accountId: "none" })
    ).toBe("Todos los meses · con filtros")
  })
})
