import { describe, expect, it } from "vitest"
import {
  formatChartAmount,
  formatCompactCurrency,
  formatCompactNumber
} from "./chart-format"

describe("formatCompactNumber", () => {
  it("abrevia en k, M y mil M con un decimal", () => {
    expect(formatCompactNumber(1250000)).toBe("1,3 M")
    expect(formatCompactNumber(350000)).toBe("350 k")
    expect(formatCompactNumber(2500000000)).toBe("2,5 mil M")
    expect(formatCompactNumber(-80000)).toBe("-80 k")
  })

  it("deja sin abreviar lo que no llega a mil", () => {
    expect(formatCompactNumber(999)).toBe("999")
    expect(formatCompactNumber(12.34)).toBe("12,3")
  })
})

describe("formatCompactCurrency", () => {
  it("antepone el símbolo corto de la moneda", () => {
    expect(formatCompactCurrency(1200000)).toBe("$ 1,2 M")
    expect(formatCompactCurrency(0)).toBe("$ 0")
    expect(formatCompactCurrency(5000, "USD")).toBe("$ 5 k")
    expect(formatCompactCurrency(1000, "EUR")).toBe("€ 1 k")
  })

  it("pone el signo antes del símbolo", () => {
    expect(formatCompactCurrency(-80000)).toBe("-$ 80 k")
  })
})

describe("formatChartAmount", () => {
  it("abrevia el monto o devuelve la máscara", () => {
    expect(formatChartAmount(1000)).toBe("$ 1 k")
    expect(formatChartAmount(1000, "COP", true)).toBe("***")
  })
})
