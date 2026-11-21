import { describe, expect, it } from "vitest"
import { amountInput, rateInput } from "./amount-format"

describe("amountInput", () => {
  it("da el monto en es-CO con hasta dos decimales", () => {
    expect(amountInput(1500000)).toBe("1.500.000")
    expect(amountInput(1234.567)).toBe("1.234,57")
    expect(amountInput(-2500.5)).toBe("-2.500,5")
    expect(amountInput(0)).toBe("0")
  })

  it("da texto vacío sin monto", () => {
    expect(amountInput(null)).toBe("")
    expect(amountInput(undefined)).toBe("")
  })
})

describe("rateInput", () => {
  it("da la tasa con coma decimal, sin miles y hasta tres decimales", () => {
    expect(rateInput(28.5)).toBe("28,5")
    expect(rateInput(1.23456)).toBe("1,235")
    expect(rateInput(1500)).toBe("1500")
    expect(rateInput(0)).toBe("0")
  })

  it("da texto vacío sin tasa", () => {
    expect(rateInput(null)).toBe("")
    expect(rateInput(undefined)).toBe("")
  })
})
