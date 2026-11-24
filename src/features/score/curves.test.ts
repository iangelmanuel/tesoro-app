import { describe, expect, it } from "vitest"
import {
  bandInfo,
  closedMonths,
  daysBetween,
  historyMonths,
  interpolate,
  isoWeekStart,
  missingHistoryDays,
  monthEnd,
  referenceDate,
  regularityCounts,
  scoreBand,
  scoreVariation,
  weightedScore,
  windowMonths,
  windowWeeks
} from "./curves"

describe("interpolate", () => {
  const curve = [
    [0.1, 100],
    [0.3, 75],
    [0.7, 25],
    [1, 0]
  ] as const

  it("topa en los extremos", () => {
    expect(interpolate(curve, 0)).toBe(100)
    expect(interpolate(curve, 1.5)).toBe(0)
  })

  it("interpola entre puntos", () => {
    expect(interpolate(curve, 0.2)).toBeCloseTo(87.5)
    expect(interpolate(curve, 0.5)).toBeCloseTo(50)
    expect(interpolate(curve, 0.85)).toBeCloseTo(12.5)
  })
})

describe("fechas", () => {
  it("cuenta días y semanas ISO", () => {
    expect(daysBetween("2026-01-01", "2026-03-01")).toBe(59)
    expect(isoWeekStart("2026-06-15")).toBe("2026-06-15")
    expect(isoWeekStart("2026-06-21")).toBe("2026-06-15")
    expect(isoWeekStart("2026-01-01")).toBe("2025-12-29")
  })

  it("da el fin de mes y la referencia", () => {
    expect(monthEnd("2024-02")).toBe("2024-02-29")
    expect(referenceDate("2026-06", "2026-06-15")).toBe("2026-06-15")
    expect(referenceDate("2026-05", "2026-06-15")).toBe("2026-05-31")
  })
})

describe("ventana y meses cerrados", () => {
  it("windowMonths respeta el primer movimiento", () => {
    expect(windowMonths("2026-06", null)).toEqual([])
    expect(windowMonths("2026-06", "2025-01-10")).toEqual([
      "2026-04",
      "2026-05",
      "2026-06"
    ])
    expect(windowMonths("2026-06", "2026-05-20")).toEqual([
      "2026-05",
      "2026-06"
    ])
    expect(windowMonths("2026-06", "2026-07-01")).toEqual([])
  })

  it("closedMonths da los anteriores a M", () => {
    expect(closedMonths("2026-06", null)).toEqual([])
    expect(closedMonths("2026-06", "2025-01-10")).toEqual([
      "2026-03",
      "2026-04",
      "2026-05"
    ])
    expect(closedMonths("2026-06", "2026-04-02", 6)).toEqual([
      "2026-04",
      "2026-05"
    ])
  })

  it("missingHistoryDays cuenta hasta 30 días", () => {
    const timeline = { today: "2026-06-15", firstTransactionOn: "2026-06-01" }
    expect(missingHistoryDays(timeline, "2026-06")).toBe(16)
    expect(
      missingHistoryDays({ ...timeline, firstTransactionOn: null }, "2026-06")
    ).toBe(30)
    expect(
      missingHistoryDays(
        { ...timeline, firstTransactionOn: "2026-01-01" },
        "2026-06"
      )
    ).toBe(0)
  })
})

describe("semanas", () => {
  const timeline = {
    today: "2026-06-15",
    firstTransactionOn: "2026-04-08",
    activeWeeks: new Set([
      "2026-04-06",
      "2026-04-20",
      "2026-06-15",
      "2026-01-05"
    ])
  }

  it("windowWeeks va del primer movimiento a la referencia", () => {
    expect(windowWeeks(timeline, "2026-06")).toMatchInlineSnapshot(`
      [
        "2026-04-06",
        "2026-04-13",
        "2026-04-20",
        "2026-04-27",
        "2026-05-04",
        "2026-05-11",
        "2026-05-18",
        "2026-05-25",
        "2026-06-01",
        "2026-06-08",
        "2026-06-15",
      ]
    `)
    expect(
      windowWeeks({ ...timeline, firstTransactionOn: null }, "2026-06")
    ).toEqual([])
  })

  it("regularityCounts cuenta las semanas activas de la ventana", () => {
    expect(regularityCounts(timeline, "2026-06")).toEqual({
      active: 3,
      total: 11
    })
  })
})

describe("ponderación y bandas", () => {
  it("weightedScore ignora factores excluidos y redondea", () => {
    expect(
      weightedScore([
        { key: "a", weight: 25, value: 0.1, points: 50 },
        { key: "b", weight: 15, excluded: "Sin datos" },
        { key: "c", weight: 10, value: 1, points: 100 }
      ])
    ).toBe(64)
    expect(weightedScore([{ key: "a", weight: 10, excluded: "x" }])).toBe(0)
  })

  it("scoreBand y bandInfo cortan en 80, 60 y 40", () => {
    expect([100, 80, 79, 60, 59, 40, 39, 0].map(scoreBand)).toEqual([
      "excellent",
      "excellent",
      "good",
      "good",
      "fair",
      "fair",
      "weak",
      "weak"
    ])
    expect(bandInfo("good")).toEqual({
      band: "good",
      min: 60,
      label: "Bueno",
      tone: "info"
    })
  })

  it("scoreVariation solo compara meses con score", () => {
    const withScore = {
      month: "2026-06",
      score: 70,
      band: "good" as const,
      factors: []
    }
    expect(
      scoreVariation(withScore, { ...withScore, month: "2026-05", score: 64 })
    ).toBe(6)
    expect(
      scoreVariation(withScore, { month: "2026-05", insufficient: ["x"] })
    ).toBeNull()
  })

  it("historyMonths da los 12 meses hasta el actual", () => {
    const months = historyMonths("2026-06-15")
    expect(months).toHaveLength(12)
    expect(months[0]).toBe("2025-07")
    expect(months[11]).toBe("2026-06")
  })
})
