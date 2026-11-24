import { describe, expect, it } from "vitest"
import { monthStart, parseBudgetMonth } from "./month"

describe("monthStart", () => {
  it("da el primer día del mes", () => {
    expect(monthStart("2026-11")).toBe("2026-11-01")
  })
})

describe("parseBudgetMonth", () => {
  const NOW = new Date("2026-11-15T17:00:00Z")

  it("lee el mes y nombra sus vecinos", () => {
    expect(parseBudgetMonth("2026-01", NOW)).toEqual({
      month: "2026-01",
      label: "enero 2026",
      prev: "2025-12",
      next: "2026-02"
    })
  })

  it("usa el primer valor de un parámetro repetido", () => {
    expect(parseBudgetMonth(["2026-12", "2026-01"], NOW).month).toBe("2026-12")
    expect(parseBudgetMonth(["2026-12"], NOW).next).toBe("2027-01")
  })

  it("cae al mes actual con un valor inválido o ausente", () => {
    expect(parseBudgetMonth("2026-13", NOW).month).toBe("2026-11")
    expect(parseBudgetMonth(undefined, NOW)).toEqual({
      month: "2026-11",
      label: "noviembre 2026",
      prev: "2026-10",
      next: "2026-12"
    })
  })
})
