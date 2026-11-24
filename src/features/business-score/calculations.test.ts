import { describe, expect, it } from "vitest"
import { isoWeeks } from "@/testing/fixtures"
import {
  BUSINESS_MONTHS,
  businessMonthsFixture,
  historyLine,
  summarizeScore
} from "@/testing/score-fixtures"
import {
  averageCost,
  businessInputsStart,
  businessScoreHistory,
  computeBusinessScore,
  insufficientReasons,
  monthInput,
  topCostCategory,
  windowTotals
} from "./calculations"
import type { BusinessScoreInputs } from "./types"

// Tests de caracterización (SPEC 55b): fijan el score de Empresa de hoy,
// factor por factor, antes de partir los módulos del score

const INPUTS: BusinessScoreInputs = {
  today: "2026-06-15",
  firstTransactionOn: "2025-09-03",
  ...businessMonthsFixture(BUSINESS_MONTHS),
  activeWeeks: new Set([
    ...isoWeeks("2025-09-01", "2026-02-23"),
    ...isoWeeks("2026-03-02", "2026-06-15", 3)
  ])
}

describe("totales", () => {
  it("monthInput da ceros a un mes sin datos", () => {
    expect(monthInput(INPUTS, "2024-01")).toEqual({
      month: "2024-01",
      sales: 0,
      costs: 0,
      accountsBalance: 0
    })
  })

  it("windowTotals y averageCost suman la ventana y los meses cerrados", () => {
    expect(windowTotals(INPUTS, "2026-06")).toEqual({
      sales: 24_000_000,
      costs: 23_000_000
    })
    expect(averageCost(INPUTS, "2026-06")).toBe(26_500_000 / 3)
    expect(averageCost(INPUTS, "2025-09")).toBeNull()
  })

  it("topCostCategory da la categoría de mayor costo de la ventana", () => {
    expect(topCostCategory(INPUTS, "2026-06")).toEqual({
      categoryId: "payroll",
      name: "Nómina",
      total: 13_000_000,
      share: 13_000_000 / 23_000_000
    })
    expect(topCostCategory({ ...INPUTS, months: [] }, "2026-06")).toBeNull()
  })
})

describe("insufficientReasons", () => {
  it("pide ventas y días de historia", () => {
    expect(insufficientReasons(INPUTS, "2025-08")).toEqual([
      "Registra tus entradas",
      "Necesitamos 30 días de registros (faltan 33 días)"
    ])
    expect(insufficientReasons(INPUTS, "2026-06")).toEqual([])
  })
})

describe("computeBusinessScore", () => {
  it("fija el score del mes actual factor por factor", () => {
    expect(summarizeScore(computeBusinessScore(INPUTS, "2026-06")))
      .toMatchInlineSnapshot(`
      {
        "band": "weak",
        "factors": [
          "net_margin ×30: 0.041666666666666664 → 20.833333333333332",
          "liquidity ×25: 0.33962264150943394 → 11.320754716981131",
          "sales_growth ×15: 0.03333333333333333 → 58.33333333333333",
          "profitable_months ×15: 0.6666666666666666 → 66.66666666666666",
          "cost_concentration ×10: 0.5652173913043478 → 33.69565217391305",
          "regularity ×5: 0.3333333333333333 → 33.33333333333333",
        ],
        "month": "2026-06",
        "score": 33,
      }
    `)
  })

  it("fija el score de un mes pasado con factores excluidos", () => {
    expect(summarizeScore(computeBusinessScore(INPUTS, "2025-11")))
      .toMatchInlineSnapshot(`
      {
        "band": "good",
        "factors": [
          "net_margin ×30: 0.21052631578947367 → 100",
          "liquidity ×25: 0.8275862068965517 → 27.586206896551722",
          "sales_growth ×15: Necesita 6 meses cerrados",
          "profitable_months ×15: 1 → 100",
          "cost_concentration ×10: 0.4222222222222222 → 69.44444444444444",
          "regularity ×5: 1 → 100",
        ],
        "month": "2025-11",
        "score": 75,
      }
    `)
  })
})

describe("businessScoreHistory", () => {
  it("fija el score de los 12 meses hasta hoy", () => {
    expect(businessScoreHistory(INPUTS).map(historyLine))
      .toMatchInlineSnapshot(`
      [
        "2025-07: Registra tus entradas / Necesitamos 30 días de registros (faltan 64 días)",
        "2025-08: Registra tus entradas / Necesitamos 30 días de registros (faltan 33 días)",
        "2025-09: Necesitamos 30 días de registros (faltan 3 días)",
        "2025-10: 74 (good)",
        "2025-11: 75 (good)",
        "2025-12: 72 (good)",
        "2026-01: 56 (fair)",
        "2026-02: 53 (fair)",
        "2026-03: 60 (good)",
        "2026-04: 65 (good)",
        "2026-05: 59 (fair)",
        "2026-06: 33 (weak)",
      ]
    `)
  })
})

describe("businessInputsStart", () => {
  it("empieza 6 meses antes", () => {
    expect(businessInputsStart("2025-07")).toBe("2025-01")
  })
})
