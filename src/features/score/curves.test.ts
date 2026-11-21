import { describe, expect, it } from "vitest"
import { monthsBetween } from "./curves"

// Caracterización (SPEC 54): lista de meses YYYY-MM. El paso 9 la mueve a
// `listMonths` de `src/libs/dates.ts`.
describe("monthsBetween (score)", () => {
  it("lista los meses de `from` a `to`, inclusive", () => {
    expect(monthsBetween("2026-10", "2027-02")).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02"
    ])
  })

  it("da un solo mes si coinciden", () => {
    expect(monthsBetween("2026-05", "2026-05")).toEqual(["2026-05"])
  })

  it("da vacío si `from` va después de `to`", () => {
    expect(monthsBetween("2026-06", "2026-05")).toEqual([])
  })
})
