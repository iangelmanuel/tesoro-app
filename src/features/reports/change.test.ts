import { describe, expect, it } from "vitest"
import {
  EMPTY,
  NEGATIVE,
  POSITIVE,
  changeTone,
  formatPercentChange
} from "./change"

describe("formatPercentChange", () => {
  it("muestra el signo y un decimal", () => {
    expect(formatPercentChange(12.34)).toBe("+12,3%")
    expect(formatPercentChange(-5)).toBe("-5%")
  })

  it("no pone signo al cero", () => {
    expect(formatPercentChange(0)).toBe("0%")
  })

  it("sin base para comparar da la raya", () => {
    expect(formatPercentChange(null)).toBe(EMPTY)
  })
})

describe("changeTone", () => {
  it("subir es bueno y bajar es malo", () => {
    expect(changeTone(10)).toBe(POSITIVE)
    expect(changeTone(-10)).toBe(NEGATIVE)
  })

  it("invertido (gastos), subir es malo", () => {
    expect(changeTone(10, true)).toBe(NEGATIVE)
    expect(changeTone(-10, true)).toBe(POSITIVE)
  })

  it("sin cambio o sin base, atenuado", () => {
    expect(changeTone(0)).toBe("text-muted-foreground")
    expect(changeTone(null)).toBe("text-muted-foreground")
  })
})
