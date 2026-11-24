import { describe, expect, it } from "vitest"
import { budgetPercent, budgetStatus, projectedPercent } from "./progress"

describe("budgetStatus", () => {
  it("está bien por debajo del 80 %", () => {
    expect(budgetStatus(79, 100)).toBe("ok")
  })

  it("avisa desde el 80 %", () => {
    expect(budgetStatus(80, 100)).toBe("warning")
    expect(budgetStatus(99.99, 100)).toBe("warning")
  })

  it("se excede desde el 100 %", () => {
    expect(budgetStatus(100, 100)).toBe("exceeded")
    expect(budgetStatus(150, 100)).toBe("exceeded")
  })
})

describe("budgetPercent", () => {
  it("trunca para no llegar al umbral antes de tiempo", () => {
    expect(budgetPercent(79.9, 100)).toBe(79)
    expect(budgetPercent(99.9, 100)).toBe(99)
    expect(budgetPercent(1, 3)).toBe(33)
  })
})

describe("projectedPercent", () => {
  it("da null sin pendientes", () => {
    expect(projectedPercent(90, 0, 100)).toBeNull()
  })

  it("da null si la proyección no llega al 80 %", () => {
    expect(projectedPercent(50, 29, 100)).toBeNull()
  })

  it("da el porcentaje proyectado desde el 80 %", () => {
    expect(projectedPercent(50, 30, 100)).toBe(80)
    expect(projectedPercent(90, 25.5, 100)).toBe(115)
  })
})
