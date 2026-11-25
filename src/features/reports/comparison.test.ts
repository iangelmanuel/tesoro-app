import { describe, expect, it } from "vitest"
import {
  type PeriodTotals,
  daysInRange,
  previousPeriod,
  sumPeriodTotals,
  wholeMonths,
  withPrevious
} from "./comparison"

const totals = (
  income: number,
  expense: number,
  txCount = 1
): PeriodTotals => ({ income, expense, balance: income - expense, txCount })

describe("sumPeriodTotals", () => {
  it("suma cada campo", () => {
    expect(sumPeriodTotals([totals(100, 40, 2), totals(50, 70, 3)])).toEqual({
      income: 150,
      expense: 110,
      balance: 40,
      txCount: 5
    })
  })

  it("sin filas da ceros", () => {
    expect(sumPeriodTotals([])).toEqual(totals(0, 0, 0))
  })
})

describe("daysInRange", () => {
  it("cuenta ambos extremos", () => {
    expect(daysInRange("2026-03-01", "2026-03-01")).toBe(1)
    expect(daysInRange("2026-02-25", "2026-03-04")).toBe(8)
  })
})

describe("wholeMonths", () => {
  it("meses completos", () => {
    expect(wholeMonths("2026-01-01", "2026-03-31")).toBe(3)
    expect(wholeMonths("2025-11-01", "2026-02-28")).toBe(4)
  })

  it("rango que no cae en meses completos da null", () => {
    expect(wholeMonths("2026-01-02", "2026-03-31")).toBeNull()
    expect(wholeMonths("2026-01-01", "2026-03-30")).toBeNull()
  })
})

describe("previousPeriod", () => {
  it("con meses completos, los N meses previos", () => {
    expect(previousPeriod("2026-04-01", "2026-06-30")).toEqual({
      months: 3,
      from: "2026-01-01",
      to: "2026-03-31"
    })
  })

  it("con un rango libre, los mismos días justo antes", () => {
    expect(previousPeriod("2026-03-10", "2026-03-19")).toEqual({
      months: null,
      from: "2026-02-28",
      to: "2026-03-09"
    })
  })
})

describe("withPrevious", () => {
  it("sin movimientos en el anterior no compara", () => {
    expect(withPrevious(totals(1, 1), totals(0, 0, 0))).toEqual({
      current: totals(1, 1),
      previous: null
    })
  })

  it("con movimientos, lo conserva", () => {
    expect(withPrevious(totals(1, 1), totals(5, 2))).toEqual({
      current: totals(1, 1),
      previous: totals(5, 2)
    })
  })
})
