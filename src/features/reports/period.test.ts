import { describe, expect, it } from "vitest"
import {
  buildReportQuery,
  currentPeriodValue,
  parseReportParams,
  reportQueryFromParams,
  shiftPeriodValue
} from "./period"

// 15 de mayo de 2026 al mediodía en Bogotá
const NOW = new Date("2026-05-15T17:00:00Z")

describe("currentPeriodValue", () => {
  it("mes, trimestre y año en America/Bogota", () => {
    expect(currentPeriodValue("month", NOW)).toBe("2026-05")
    expect(currentPeriodValue("quarter", NOW)).toBe("2026-Q2")
    expect(currentPeriodValue("year", NOW)).toBe("2026")
  })
})

describe("parseReportParams", () => {
  it("sin parámetros: el mes actual y gastos", () => {
    expect(parseReportParams({}, NOW)).toEqual({
      period: "month",
      value: "2026-05",
      from: "2026-05-01",
      to: "2026-05-31",
      label: "mayo 2026",
      type: "expense"
    })
  })

  it("respeta el periodo por defecto", () => {
    expect(parseReportParams({}, NOW, "year")).toMatchObject({
      period: "year",
      value: "2026",
      from: "2026-01-01",
      to: "2026-12-31",
      label: "2026"
    })
  })

  it("mes pedido, toma el primer valor de un array", () => {
    expect(
      parseReportParams(
        { period: "month", value: ["2026-02", "2026-03"], type: "income" },
        NOW
      )
    ).toEqual({
      period: "month",
      value: "2026-02",
      from: "2026-02-01",
      to: "2026-02-28",
      label: "febrero 2026",
      type: "income"
    })
  })

  it("trimestre", () => {
    expect(
      parseReportParams({ period: "quarter", value: "2026-Q4" }, NOW)
    ).toMatchObject({
      from: "2026-10-01",
      to: "2026-12-31",
      label: "T4 2026"
    })
  })

  it("un valor inválido cae al periodo actual", () => {
    expect(
      parseReportParams({ period: "quarter", value: "2026-Q5" }, NOW)
    ).toMatchObject({ value: "2026-Q2" })
    expect(
      parseReportParams({ period: "month", value: "2026-13", type: "x" }, NOW)
    ).toMatchObject({ value: "2026-05", type: "expense" })
  })

  it("rango del mismo año y de años distintos", () => {
    expect(
      parseReportParams(
        { period: "range", from: "2026-01-05", to: "2026-03-20" },
        NOW
      )
    ).toEqual({
      period: "range",
      value: null,
      from: "2026-01-05",
      to: "2026-03-20",
      label: "5 ene – 20 mar 2026",
      type: "expense"
    })
    expect(
      parseReportParams(
        { period: "range", from: "2025-12-05", to: "2026-01-20" },
        NOW
      ).label
    ).toBe("5 dic 2025 – 20 ene 2026")
  })

  it("un rango inválido avisa y cae al mes actual", () => {
    expect(
      parseReportParams(
        { period: "range", from: "2026-02-30", to: "2026-03-01" },
        NOW
      )
    ).toMatchObject({
      period: "month",
      value: "2026-05",
      warning: "Las fechas del rango no son válidas."
    })
    expect(
      parseReportParams(
        { period: "range", from: "2026-03-01", to: "2026-02-01" },
        NOW
      ).warning
    ).toBe("La fecha inicial es posterior a la final.")
  })

  it("un rango de más de 24 meses avisa", () => {
    expect(
      parseReportParams(
        { period: "range", from: "2024-01-01", to: "2025-12-31" },
        NOW
      ).warning
    ).toBeUndefined()
    expect(
      parseReportParams(
        { period: "range", from: "2024-01-01", to: "2026-01-01" },
        NOW
      ).warning
    ).toBe("El rango no puede cubrir más de 24 meses.")
  })
})

describe("shiftPeriodValue", () => {
  it("mueve mes, año y trimestre cruzando el año", () => {
    expect(shiftPeriodValue("month", "2026-01", -1)).toBe("2025-12")
    expect(shiftPeriodValue("year", "2026", 2)).toBe("2028")
    expect(shiftPeriodValue("quarter", "2026-Q1", -1)).toBe("2025-Q4")
    expect(shiftPeriodValue("quarter", "2026-Q4", 1)).toBe("2027-Q1")
  })
})

describe("buildReportQuery y reportQueryFromParams", () => {
  it("escribe siempre periodo y tipo", () => {
    expect(
      buildReportQuery({ period: "month", value: "2026-05", type: "expense" })
    ).toBe("period=month&value=2026-05&type=expense")
    expect(
      buildReportQuery({
        period: "range",
        from: "2026-01-01",
        to: "2026-02-01",
        type: "income"
      })
    ).toBe("period=range&from=2026-01-01&to=2026-02-01&type=income")
  })

  it("arma la query desde los params con el tipo cambiado", () => {
    const params = parseReportParams({}, NOW)
    expect(reportQueryFromParams(params, { type: "income" })).toEqual({
      period: "month",
      value: "2026-05",
      type: "income"
    })
  })
})
