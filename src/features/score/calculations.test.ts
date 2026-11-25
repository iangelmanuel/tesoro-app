import { describe, expect, it } from "vitest"
import { isoWeeks } from "@/testing/fixtures"
import {
  historyLine,
  monthlyInputFixture,
  summarizeScore
} from "@/testing/score-fixtures"
import {
  averageExpense,
  computeScore,
  consideredDebts,
  consideredGoals,
  insufficientReasons,
  scoreHistory,
  windowTotals
} from "./calculations"
import type { ScoreDebt, ScoreGoal, ScoreInputs } from "./types"

// Tests de caracterización (SPEC 55b): fijan el score de hoy, factor por
// factor, antes de partir los módulos del score

const DEBTS: ScoreDebt[] = [
  {
    id: "card",
    kind: "credit_card",
    status: "active",
    credit_limit: 5_000_000,
    min_payment: 250_000,
    installment: null,
    closed_at: null,
    created_at: "2025-10-01T15:00:00Z"
  },
  {
    id: "loan",
    kind: "loan",
    status: "active",
    credit_limit: null,
    min_payment: null,
    installment: 400_000,
    closed_at: null,
    created_at: "2025-11-10T15:00:00Z"
  },
  {
    id: "paid-loan",
    kind: "loan",
    status: "paid",
    credit_limit: null,
    min_payment: null,
    installment: 100_000,
    closed_at: "2026-02-20T15:00:00Z",
    created_at: "2025-09-10T15:00:00Z"
  },
  {
    id: "receivable",
    kind: "receivable",
    status: "active",
    credit_limit: null,
    min_payment: null,
    installment: null,
    closed_at: null,
    created_at: "2025-09-10T15:00:00Z"
  }
]

const GOALS: ScoreGoal[] = [
  {
    id: "trip",
    target_amount: 3_000_000,
    target_date: "2026-12-31",
    status: "active",
    completed_at: null,
    created_at: "2026-01-01T15:00:00Z"
  },
  {
    id: "laptop",
    target_amount: 4_000_000,
    target_date: "2026-08-31",
    status: "active",
    completed_at: null,
    created_at: "2025-12-01T15:00:00Z"
  },
  {
    id: "no-date",
    target_amount: 1_000_000,
    target_date: null,
    status: "active",
    completed_at: null,
    created_at: "2025-12-01T15:00:00Z"
  }
]

const INPUTS: ScoreInputs = {
  today: "2026-06-15",
  firstTransactionOn: "2025-09-03",
  months: [
    monthlyInputFixture("2025-09", 3_000_000, 2_100_000, 900_000),
    monthlyInputFixture("2025-10", 3_200_000, 2_900_000, 1_200_000, 4, 3),
    monthlyInputFixture("2025-11", 3_200_000, 3_500_000, 900_000, 4, 2),
    monthlyInputFixture("2025-12", 4_500_000, 3_600_000, 1_800_000, 5, 4),
    monthlyInputFixture("2026-01", 3_200_000, 2_700_000, 2_300_000, 5, 5),
    monthlyInputFixture("2026-02", 3_200_000, 2_600_000, 2_900_000, 5, 4),
    monthlyInputFixture("2026-03", 3_400_000, 3_000_000, 3_300_000, 5, 3),
    monthlyInputFixture("2026-04", 3_400_000, 2_500_000, 4_200_000, 6, 6),
    monthlyInputFixture("2026-05", 3_400_000, 3_900_000, 3_700_000, 6, 2),
    monthlyInputFixture("2026-06", 1_700_000, 1_200_000, 4_200_000, 6, 5)
  ],
  activeWeeks: new Set([
    ...isoWeeks("2025-09-01", "2026-02-23"),
    ...isoWeeks("2026-03-02", "2026-06-15", 2)
  ]),
  debtBalances: new Map([
    ["card:2025-10", 800_000],
    ["card:2025-11", 1_600_000],
    ["card:2025-12", 2_400_000],
    ["card:2026-01", 3_100_000],
    ["card:2026-02", 3_600_000],
    ["card:2026-03", 2_900_000],
    ["card:2026-04", 2_000_000],
    ["card:2026-05", 1_400_000],
    ["card:2026-06", 150_000],
    ["loan:2025-11", 6_000_000],
    ["loan:2025-12", 5_600_000],
    ["loan:2026-01", 5_200_000],
    ["loan:2026-02", 4_800_000],
    ["loan:2026-03", 4_400_000],
    ["loan:2026-04", 4_000_000],
    ["loan:2026-05", 3_600_000],
    ["loan:2026-06", 300_000],
    ["paid-loan:2025-09", 300_000],
    ["paid-loan:2025-10", 200_000],
    ["paid-loan:2025-11", 100_000],
    ["paid-loan:2025-12", 50_000],
    ["paid-loan:2026-01", 50_000]
  ]),
  goalBalances: new Map([
    ["trip:2026-01", 100_000],
    ["trip:2026-02", 300_000],
    ["trip:2026-03", 600_000],
    ["trip:2026-04", 1_000_000],
    ["trip:2026-05", 1_300_000],
    ["trip:2026-06", 1_400_000],
    ["laptop:2025-12", 500_000],
    ["laptop:2026-01", 900_000],
    ["laptop:2026-02", 1_100_000],
    ["laptop:2026-03", 1_400_000],
    ["laptop:2026-04", 1_500_000],
    ["laptop:2026-05", 1_600_000],
    ["laptop:2026-06", 1_700_000]
  ]),
  debts: DEBTS,
  goals: GOALS
}

describe("windowTotals y averageExpense", () => {
  it("suman la ventana de 3 meses y los meses cerrados", () => {
    expect(windowTotals(INPUTS, "2026-06")).toEqual({
      income: 8_500_000,
      expense: 7_600_000,
      monthlyIncome: 8_500_000 / 3
    })
    expect(averageExpense(INPUTS, "2026-06")).toBe(9_400_000 / 3)
  })

  it("acortan la ventana al mes del primer movimiento", () => {
    expect(windowTotals(INPUTS, "2025-10").income).toBe(6_200_000)
    expect(averageExpense(INPUTS, "2025-09")).toBeNull()
  })
})

describe("insufficientReasons", () => {
  it("pide ingresos y días de historia", () => {
    expect(insufficientReasons(INPUTS, "2025-08")).toEqual([
      "Registra tus entradas",
      "Necesitamos 30 días de registros (faltan 33 días)"
    ])
    expect(
      insufficientReasons({ ...INPUTS, today: "2025-09-30" }, "2025-09")
    ).toEqual(["Necesitamos 30 días de registros (faltan 3 días)"])
    expect(
      insufficientReasons({ ...INPUTS, today: "2025-10-02" }, "2025-10")
    ).toEqual(["Necesitamos 30 días de registros (faltan 1 día)"])
  })

  it("no da motivos con datos suficientes", () => {
    expect(insufficientReasons(INPUTS, "2026-06")).toEqual([])
  })
})

describe("consideredDebts y consideredGoals", () => {
  it("filtran por fecha de creación, cierre y estado", () => {
    expect(consideredDebts(DEBTS, "2025-10").map((debt) => debt.id)).toEqual([
      "card",
      "paid-loan"
    ])
    expect(consideredDebts(DEBTS, "2026-03").map((debt) => debt.id)).toEqual([
      "card",
      "loan"
    ])
    expect(consideredGoals(GOALS, "2025-12").map((goal) => goal.id)).toEqual([
      "laptop"
    ])
    expect(consideredGoals(GOALS, "2026-06").map((goal) => goal.id)).toEqual([
      "trip",
      "laptop"
    ])
  })
})

describe("computeScore", () => {
  it("fija el score del mes actual factor por factor", () => {
    expect(summarizeScore(computeScore(INPUTS, "2026-06")))
      .toMatchInlineSnapshot(`
      {
        "band": "good",
        "factors": [
          "savings_rate ×25: 0.10588235294117647 → 52.94117647058824",
          "debt_to_income ×20: 0.1588235294117647 → 97.47899159663865",
          "emergency_cushion ×15: 1.3404255319148934 → 22.34042553191489",
          "budgets ×15: 0.8333333333333334 → 83.33333333333334",
          "card_utilization ×10: 0.03 → 100",
          "goals ×10: 0.5 → 50",
          "regularity ×5: 0.5 → 50",
        ],
        "month": "2026-06",
        "score": 66,
      }
    `)
  })

  it("fija el score de un mes pasado", () => {
    expect(summarizeScore(computeScore(INPUTS, "2025-12")))
      .toMatchInlineSnapshot(`
      {
        "band": "good",
        "factors": [
          "savings_rate ×25: 0.08256880733944955 → 41.284403669724774",
          "debt_to_income ×20: 0.19266055045871558 → 87.81127129750983",
          "emergency_cushion ×15: 0.6352941176470588 → 10.588235294117647",
          "budgets ×15: 0.8 → 80",
          "card_utilization ×10: 0.48 → 52.5",
          "goals ×10: 1 → 100",
          "regularity ×5: 1 → 100",
        ],
        "month": "2025-12",
        "score": 62,
      }
    `)
  })

  it("excluye factores sin datos", () => {
    expect(
      summarizeScore(
        computeScore({ ...INPUTS, debts: [], goals: [] }, "2025-10")
      )
    ).toMatchInlineSnapshot(`
      {
        "band": "good",
        "factors": [
          "savings_rate ×25: 0.1935483870967742 → 96.77419354838709",
          "debt_to_income ×20: 0 → 100",
          "emergency_cushion ×15: 0.5714285714285714 → 9.523809523809524",
          "budgets ×15: 0.75 → 75",
          "card_utilization ×10: Sin tarjetas de crédito",
          "goals ×10: Sin metas con fecha objetivo",
          "regularity ×5: 1 → 100",
        ],
        "month": "2025-10",
        "score": 77,
      }
    `)
  })
})

describe("scoreHistory", () => {
  it("fija el score de los 12 meses hasta hoy", () => {
    expect(scoreHistory(INPUTS).map(historyLine)).toMatchInlineSnapshot(`
      [
        "2025-07: Registra tus entradas / Necesitamos 30 días de registros (faltan 64 días)",
        "2025-08: Registra tus entradas / Necesitamos 30 días de registros (faltan 33 días)",
        "2025-09: Necesitamos 30 días de registros (faltan 3 días)",
        "2025-10: 79 (good)",
        "2025-11: 53 (fair)",
        "2025-12: 62 (good)",
        "2026-01: 60 (good)",
        "2026-02: 63 (good)",
        "2026-03: 56 (fair)",
        "2026-04: 75 (good)",
        "2026-05: 51 (fair)",
        "2026-06: 66 (good)",
      ]
    `)
  })
})
