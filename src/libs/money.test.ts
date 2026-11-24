import { describe, expect, it } from "vitest"
import { roundCents } from "./money"

describe("roundCents", () => {
  it("quita el error de punto flotante", () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3)
    expect(roundCents(1000 - 999.99)).toBe(0.01)
  })

  it("redondea a dos decimales", () => {
    expect(roundCents(1.236)).toBe(1.24)
    expect(roundCents(1.234)).toBe(1.23)
    expect(roundCents(-5.554)).toBe(-5.55)
    expect(roundCents(42)).toBe(42)
  })
})
