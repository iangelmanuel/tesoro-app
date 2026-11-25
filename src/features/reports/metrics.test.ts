import { describe, expect, it } from "vitest"
import {
  balanceDifference,
  dailyAverage,
  groupTopWithOthers,
  monthProgress,
  monthProjection,
  percentChange,
  percentShares,
  savingsRate
} from "./metrics"

describe("percentChange", () => {
  it("variación contra el valor absoluto del anterior", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, -100)).toBe(150)
  })

  it("sin base da null", () => {
    expect(percentChange(10, 0)).toBeNull()
  })
})

describe("balanceDifference", () => {
  it("resta en dinero", () => {
    expect(balanceDifference(300, 500)).toBe(-200)
  })
})

describe("savingsRate", () => {
  it("balance sobre ingresos, puede ser negativa", () => {
    expect(savingsRate(1000, 750)).toBe(25)
    expect(savingsRate(100, 150)).toBe(-50)
  })

  it("sin ingresos da null", () => {
    expect(savingsRate(0, 100)).toBeNull()
  })
})

describe("monthProgress", () => {
  it("día de hoy y días del mes", () => {
    expect(monthProgress("2026-02-10")).toEqual({
      daysElapsed: 10,
      daysInMonth: 28
    })
    expect(monthProgress("2028-02-29")).toEqual({
      daysElapsed: 29,
      daysInMonth: 29
    })
  })
})

describe("dailyAverage y monthProjection", () => {
  it("promedia y proyecta al ritmo diario", () => {
    expect(dailyAverage(300, 10)).toBe(30)
    expect(monthProjection(30, 31)).toBe(930)
  })

  it("sin días transcurridos el promedio es 0", () => {
    expect(dailyAverage(300, 0)).toBe(0)
  })
})

describe("groupTopWithOthers", () => {
  const items = [{ total: 50 }, { total: 30 }, { total: 15 }, { total: 5 }]

  it("si cabe todo, no hay resto", () => {
    expect(groupTopWithOthers(items, 4)).toEqual({ top: items, others: null })
  })

  it("suma el resto en 'otras'", () => {
    expect(groupTopWithOthers(items, 2)).toEqual({
      top: items.slice(0, 2),
      others: { total: 20, count: 2 }
    })
  })
})

describe("percentShares", () => {
  it("el redondeo suma exactamente 100", () => {
    const shares = percentShares([1, 1, 1])
    expect(shares).toEqual([33.4, 33.3, 33.3])
  })

  it("con cero decimales", () => {
    expect(percentShares([1, 1, 1], 0)).toEqual([34, 33, 33])
  })

  it("sin total, todo en cero", () => {
    expect(percentShares([0, 0])).toEqual([0, 0])
  })
})
