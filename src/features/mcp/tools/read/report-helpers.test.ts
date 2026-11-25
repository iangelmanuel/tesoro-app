import { afterEach, describe, expect, it, vi } from "vitest"
import { categoryTotalFixture } from "@/testing/fixtures"
import {
  MAX_REPORT_MONTHS,
  categoryRows,
  margin,
  monthTotals,
  resolveMonthRange,
  totalsFor
} from "./report-helpers"

const ROW = { income: 1000.555, expense: 400.123, balance: 600.432, txCount: 7 }

describe("margin", () => {
  it("utilidad sobre ventas, null sin ventas", () => {
    expect(margin(200, 150)).toBe(25)
    expect(margin(0, 10)).toBeNull()
  })
})

describe("totalsFor y monthTotals", () => {
  it("Personal: ingresos, gastos, balance y tasa de ahorro", () => {
    expect(totalsFor("personal", ROW)).toEqual({
      income: 1000.56,
      expense: 400.12,
      balance: 600.43,
      savings_rate_percent: 60,
      transaction_count: 7
    })
  })

  it("Empresa: ventas, costos, utilidad y margen", () => {
    expect(totalsFor("business", { ...ROW, income: 0 })).toEqual({
      sales: 0,
      costs_and_expenses: 400.12,
      profit: 600.43,
      margin_percent: null,
      transaction_count: 7
    })
  })

  it("monthTotals agrega el mes YYYY-MM", () => {
    expect(
      monthTotals("personal", { ...ROW, month: "2026-10-01" })
    ).toMatchObject({ month: "2026-10", income: 1000.56 })
  })
})

describe("categoryRows", () => {
  const rows = [
    { ...categoryTotalFixture("a", "A", 200), txCount: 2 },
    categoryTotalFixture("b", "B", 100),
    categoryTotalFixture("c", "C", 0.335)
  ]

  it("participación sobre el total de todas, aunque se corte", () => {
    expect(categoryRows(rows, 2)).toEqual([
      {
        category_id: "a",
        name: "A",
        total: 200,
        share_percent: 66.6,
        transaction_count: 2
      },
      {
        category_id: "b",
        name: "B",
        total: 100,
        share_percent: 33.3,
        transaction_count: 1
      }
    ])
    expect(categoryRows(rows)[2]).toMatchObject({ total: 0.34 })
  })

  it("sin total la participación es 0", () => {
    expect(
      categoryRows([categoryTotalFixture("a", "A", 0)])[0].share_percent
    ).toBe(0)
  })
})

describe("resolveMonthRange", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("rango explícito con sus fechas", () => {
    expect(resolveMonthRange("2026-01", "2026-03", 6)).toEqual({
      from: "2026-01",
      to: "2026-03",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31"
    })
  })

  it("sin from, los últimos N meses hasta hoy", () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T17:00:00Z") })
    expect(resolveMonthRange(undefined, undefined, 6)).toMatchObject({
      from: "2026-06",
      to: "2026-11"
    })
  })

  it("errores de orden y de largo", () => {
    expect(resolveMonthRange("2026-05", "2026-04", 6)).toEqual({
      error: "El mes de inicio (from) debe ser anterior o igual a to."
    })
    expect(resolveMonthRange("2023-01", "2026-01", MAX_REPORT_MONTHS)).toEqual({
      error: "El periodo puede tener hasta 36 meses."
    })
  })
})
