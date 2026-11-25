import { describe, expect, it } from "vitest"
import {
  type ExportSelection,
  changeSelectionPeriod,
  initialSelection,
  quarterOf,
  selectionMonths
} from "./export-selection"

const CURRENT = "2026-11"
const START = "2025-03"

const selection = (
  overrides: Partial<ExportSelection> = {}
): ExportSelection => ({
  period: "month",
  value: CURRENT,
  from: CURRENT,
  to: CURRENT,
  ...overrides
})

describe("quarterOf", () => {
  it("trimestre del mes", () => {
    expect(quarterOf("2026-01")).toBe("2026-Q1")
    expect(quarterOf("2026-11")).toBe("2026-Q4")
  })
})

describe("selectionMonths", () => {
  it("trimestre y año se cortan en el mes actual", () => {
    expect(
      selectionMonths(
        selection({ period: "quarter", value: "2026-Q4" }),
        CURRENT,
        START
      )
    ).toEqual({ from: "2026-10", to: "2026-11" })
    expect(
      selectionMonths(
        selection({ period: "year", value: "2025" }),
        CURRENT,
        START
      )
    ).toEqual({ from: "2025-01", to: "2025-12" })
  })

  it("todo el historial va del primer mes al actual", () => {
    expect(
      selectionMonths(selection({ period: "all" }), CURRENT, START)
    ).toEqual({ from: START, to: CURRENT })
  })
})

describe("initialSelection", () => {
  it("sin parámetros toma el mes actual de Reportes", () => {
    const result = initialSelection(new URLSearchParams(), CURRENT)
    expect(result.period).toBe("month")
  })

  it("un rango por días pasa a sus meses, sin pasar del actual", () => {
    expect(
      initialSelection(
        new URLSearchParams({
          period: "range",
          from: "2026-02-10",
          to: "2026-04-05"
        }),
        CURRENT
      )
    ).toEqual({
      period: "range",
      value: CURRENT,
      from: "2026-02",
      to: "2026-04"
    })
  })

  it("un trimestre futuro cae al actual", () => {
    expect(
      initialSelection(
        new URLSearchParams({ period: "quarter", value: "2027-Q2" }),
        CURRENT
      )
    ).toEqual({
      period: "quarter",
      value: "2026-Q4",
      from: CURRENT,
      to: CURRENT
    })
  })
})

describe("changeSelectionPeriod", () => {
  it("conserva el último mes que cubría", () => {
    const range = selection({ period: "range", from: "2026-02", to: "2026-05" })
    expect(changeSelectionPeriod(range, "month", CURRENT, START)).toMatchObject(
      { period: "month", value: "2026-05" }
    )
    expect(
      changeSelectionPeriod(range, "quarter", CURRENT, START)
    ).toMatchObject({ period: "quarter", value: "2026-Q2" })
    expect(changeSelectionPeriod(range, "year", CURRENT, START)).toMatchObject({
      period: "year",
      value: "2026"
    })
  })

  it("a rango, los meses de la selección anterior", () => {
    expect(
      changeSelectionPeriod(
        selection({ period: "year", value: "2025" }),
        "range",
        CURRENT,
        START
      )
    ).toMatchObject({ period: "range", from: "2025-01", to: "2025-12" })
  })
})
