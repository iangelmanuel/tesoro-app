import { describe, expect, it } from "vitest"
import { CARD, LOAN } from "@/testing/debt-samples"
import {
  globalUtilization,
  utilizationLevel,
  utilizationPercent
} from "./utilization"

// Tests de caracterización (SPEC 55b): fijan la utilización del cupo

describe("utilización", () => {
  it("por tarjeta y global", () => {
    expect(utilizationPercent(2_999_999, 10_000_000)).toBe(29)
    expect(utilizationPercent(-10, 100)).toBe(0)
    expect([0, 29, 30, 69, 70].map(utilizationLevel)).toEqual([
      "healthy",
      "healthy",
      "moderate",
      "moderate",
      "high"
    ])
    expect(
      globalUtilization([
        CARD,
        { ...CARD, id: "mc", credit_limit: 3_000_000, balance: 1_000_000 },
        { ...CARD, id: "old", status: "archived" }
      ])
    ).toBe(37)
    expect(globalUtilization([LOAN])).toBeNull()
  })
})
