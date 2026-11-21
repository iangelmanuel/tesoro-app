import { describe, expect, it } from "vitest"
import { monthsBetween } from "./report-helpers"

// Caracterización (SPEC 54): cuántos meses hay. El paso 9 la mueve a
// `countMonths` de `src/libs/dates.ts`.
describe("monthsBetween (MCP)", () => {
  it("cuenta los meses de `from` a `to`, ambos incluidos", () => {
    expect(monthsBetween("2026-10", "2027-02")).toBe(5)
    expect(monthsBetween("2026-01", "2026-12")).toBe(12)
  })

  it("da 1 si coinciden", () => {
    expect(monthsBetween("2026-05", "2026-05")).toBe(1)
  })

  it("da cero o negativo si `from` va después de `to`", () => {
    expect(monthsBetween("2026-06", "2026-05")).toBe(0)
    expect(monthsBetween("2026-08", "2026-05")).toBe(-2)
  })
})
