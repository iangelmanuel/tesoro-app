import { describe, expect, it } from "vitest"
import { CARD, CARD_NO_MIN, LOAN, RECEIVABLE } from "@/testing/debt-samples"
import {
  debtProjection,
  monthlyInterest,
  monthlyRate,
  projectPayoff,
  totalMonthlyInterest
} from "./projection"

// Tests de caracterización (SPEC 55b): fijan la tasa, el interés y la proyección de pago

describe("proyección", () => {
  it("tasa e interés del mes", () => {
    expect(monthlyRate(26.82, "ea")).toBeCloseTo(0.02, 4)
    expect(monthlyRate(1.5, "mv")).toBe(0.015)
    expect(monthlyRate(null, "ea")).toBe(0)
    expect(monthlyInterest(LOAN)).toBe(45_000)
    expect(
      totalMonthlyInterest([CARD, LOAN, RECEIVABLE])
    ).toMatchInlineSnapshot(`86569.46`)
  })

  it("projectPayoff en centavos", () => {
    expect(projectPayoff(1_000_000, 0.02, 100_000, "2026-07-05"))
      .toMatchInlineSnapshot(`
        {
          "kind": "ok",
          "months": 12,
          "payoffMonth": "2027-06",
          "totalInterest": 127032.84,
        }
      `)
    expect(projectPayoff(1_000_000, 0.02, 20_000, "2026-07-05")).toEqual({
      kind: "no_progress"
    })
    expect(projectPayoff(100_000_000, 0, 1, "2026-07-05")).toEqual({
      kind: "too_long"
    })
  })

  it("debtProjection con la cuota, el simulador o sin mínimo", () => {
    expect(debtProjection(LOAN)).toMatchInlineSnapshot(`
      {
        "kind": "ok",
        "months": 9,
        "payoffMonth": "2027-03",
        "totalInterest": 206437.26,
        "withoutRate": false,
      }
    `)
    expect(debtProjection(CARD, 1_000_000)).toMatchInlineSnapshot(`
      {
        "kind": "ok",
        "months": 3,
        "payoffMonth": "2026-08",
        "totalInterest": 64532.17,
        "withoutRate": false,
      }
    `)
    expect(debtProjection(CARD_NO_MIN)).toEqual({ kind: "needs_min_payment" })
    expect(debtProjection(RECEIVABLE)).toBeNull()
  })
})
