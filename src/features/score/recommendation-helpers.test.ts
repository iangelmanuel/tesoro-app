import { describe, expect, it } from "vitest"
import { accountFixture } from "@/testing/fixtures"
import {
  compareRecommendations,
  formatMonthName,
  hasFullMonthsBefore,
  irregularRecordsRecommendation,
  isUnusualGrowth,
  negativeAccountRecommendations
} from "./recommendation-helpers"
import type { Recommendation } from "./types"

describe("formatMonthName", () => {
  it("da el nombre del mes", () => {
    expect(formatMonthName("2026-09")).toBe("septiembre")
  })
})

describe("hasFullMonthsBefore", () => {
  it("exige el primer movimiento el día 1 del primer mes o antes", () => {
    expect(hasFullMonthsBefore("2026-02-01", "2026-05", 3)).toBe(true)
    expect(hasFullMonthsBefore("2026-01-20", "2026-05", 3)).toBe(true)
    expect(hasFullMonthsBefore("2026-02-02", "2026-05", 3)).toBe(false)
    expect(hasFullMonthsBefore(null, "2026-05", 3)).toBe(false)
  })
})

describe("isUnusualGrowth", () => {
  const thresholds = { ratio: 1.3, minShare: 0.05 }

  it("cuenta el 130 % exacto y una diferencia del 5 % exacto", () => {
    expect(isUnusualGrowth(1_300_000, 1_000_000, 6_000_000, thresholds)).toBe(
      true
    )
    expect(isUnusualGrowth(1_290_000, 1_000_000, 1_000_000, thresholds)).toBe(
      false
    )
  })

  it("no cuenta una diferencia chica frente al promedio mensual", () => {
    expect(isUnusualGrowth(130, 100, 1_000_000, thresholds)).toBe(false)
  })

  it("no cuenta una categoría sin promedio", () => {
    expect(isUnusualGrowth(500, 0, 1_000, thresholds)).toBe(false)
  })
})

describe("negativeAccountRecommendations", () => {
  const href = "/dashboard/personal/accounts"
  const accounts = [
    accountFixture({ id: "w", name: "Nequi", kind: "wallet", balance: -50 }),
    accountFixture({ id: "c", name: "Efectivo", kind: "cash", balance: -10 }),
    accountFixture({ id: "b", name: "Banco", balance: 100 })
  ]

  it("recomienda solo billeteras y bancos en negativo", () => {
    expect(
      negativeAccountRecommendations(accounts, href).map((row) => row.entityKey)
    ).toEqual(["w"])
  })

  it("usa la moneda del espacio", () => {
    const [row] = negativeAccountRecommendations(accounts, href, "USD")
    expect(row.evidence).toMatchInlineSnapshot(
      `"Nequi tiene saldo de −US$ 50,00"`
    )
  })
})

describe("compareRecommendations", () => {
  it("ordena por severidad y luego por monto", () => {
    const item = (severity: Recommendation["severity"], amount: number) =>
      ({ severity, amount }) as Recommendation
    const sorted = [
      item("low", 900),
      item("high", 10),
      item("medium", 5),
      item("high", 50)
    ].sort(compareRecommendations)

    expect(sorted.map((row) => `${row.severity}:${row.amount}`)).toEqual([
      "high:50",
      "high:10",
      "medium:5",
      "low:900"
    ])
  })
})

describe("irregularRecordsRecommendation", () => {
  const href = "/dashboard/personal/transactions"

  it("recomienda con menos del 50 % de semanas con movimientos", () => {
    expect(
      irregularRecordsRecommendation({ active: 5, total: 12 }, href)
    ).toEqual([
      {
        rule: "irregular_records",
        entityKey: "workspace",
        severity: "low",
        title: "Registra tus movimientos con más frecuencia",
        evidence: "Registraste movimientos en 5 de 12 semanas",
        amount: 0,
        href,
        linkLabel: "Ir a Movimientos"
      }
    ])
  })

  it("no recomienda desde el 50 % ni sin semanas", () => {
    expect(
      irregularRecordsRecommendation({ active: 6, total: 12 }, href)
    ).toEqual([])
    expect(
      irregularRecordsRecommendation({ active: 0, total: 0 }, href)
    ).toEqual([])
  })
})
