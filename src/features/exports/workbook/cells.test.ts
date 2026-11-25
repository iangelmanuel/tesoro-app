import { describe, expect, it } from "vitest"
import { columnLetter, displayLength, excelDate } from "./cells"

describe("columnLetter", () => {
  it("de 1 a A y de 27 a AA", () => {
    expect(columnLetter(1)).toBe("A")
    expect(columnLetter(26)).toBe("Z")
    expect(columnLetter(27)).toBe("AA")
    expect(columnLetter(703)).toBe("AAA")
  })
})

describe("excelDate", () => {
  it("fecha UTC sin correr el día", () => {
    expect(excelDate("2026-03-01").toISOString()).toBe(
      "2026-03-01T00:00:00.000Z"
    )
  })
})

describe("displayLength", () => {
  it("monto con signo de pesos y puntos de miles", () => {
    expect(displayLength(1_500_000, "money")).toBe(11)
    expect(displayLength(-999, "money")).toBe(5)
  })

  it("anchos fijos por tipo y texto por largo", () => {
    expect(displayLength(0.5, "percent")).toBe(7)
    expect(displayLength(new Date(), "date")).toBe(10)
    expect(displayLength("14:30", "time")).toBe(5)
    expect(displayLength("Mercado", "text")).toBe(7)
    expect(displayLength(null, "text")).toBe(0)
  })
})
