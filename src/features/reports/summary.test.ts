import { describe, expect, it } from "vitest"
import type { MonthlyTotal } from "./queries"
import { monthlyTrendSummary, personalSummaryKpis } from "./summary"

const row = (
  month: string,
  income: number,
  expense: number,
  txCount = 1
): MonthlyTotal => ({
  month,
  income,
  expense,
  balance: income - expense,
  txCount
})

describe("monthlyTrendSummary", () => {
  it("toma el último mes como actual y el penúltimo como anterior", () => {
    const monthly = [
      row("2026-09-01", 100, 40),
      row("2026-10-01", 200, 50),
      row("2026-11-01", 300, 100)
    ]
    expect(monthlyTrendSummary(monthly)).toEqual({
      current: monthly[2],
      previous: monthly[1],
      isEmptyTrend: false,
      trendBalance: 410
    })
  })

  it("marca la tendencia vacía sin movimientos", () => {
    const monthly = [row("2026-10-01", 0, 0, 0), row("2026-11-01", 0, 0, 0)]
    expect(monthlyTrendSummary(monthly).isEmptyTrend).toBe(true)
  })
})

describe("personalSummaryKpis", () => {
  it("calcula el saldo acumulado al cierre del mes anterior", () => {
    const monthly = [row("2026-10-01", 200, 50), row("2026-11-01", 300, 100)]
    const kpis = personalSummaryKpis(monthly, 1000)
    expect(kpis.previous).toBe(monthly[0])
    expect(kpis.previousAccumulated).toBe(800)
    expect(kpis.hadHistory).toBe(true)
    expect(kpis.trendBalance).toBe(350)
  })

  it("sin movimientos el mes anterior no hay badge", () => {
    const monthly = [row("2026-10-01", 0, 0, 0), row("2026-11-01", 300, 100)]
    const kpis = personalSummaryKpis(monthly, 200)
    expect(kpis.previous).toBeNull()
    expect(kpis.previousAccumulated).toBe(0)
    expect(kpis.hadHistory).toBe(false)
  })

  it("hay historia si había saldo antes aunque el mes anterior esté vacío", () => {
    const monthly = [row("2026-10-01", 0, 0, 0), row("2026-11-01", 300, 100)]
    expect(personalSummaryKpis(monthly, 500).hadHistory).toBe(true)
  })
})
