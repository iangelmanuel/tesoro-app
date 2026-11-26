import { describe, expect, it } from "vitest"
import { REPORT_LABELS } from "./labels"
import { incomeExpenseLegend } from "./series"

describe("incomeExpenseLegend", () => {
  it("entradas y salidas, en ese orden", () => {
    expect(incomeExpenseLegend()).toEqual([
      { label: "Entradas", color: "var(--income)" },
      { label: "Salidas", color: "var(--expense)" }
    ])
  })

  it("con balance agrega la tercera serie", () => {
    expect(incomeExpenseLegend(REPORT_LABELS.business, true)).toEqual([
      { label: "Entradas", color: "var(--income)" },
      { label: "Salidas", color: "var(--expense)" },
      { label: "Balance", color: "var(--balance)" }
    ])
  })
})
