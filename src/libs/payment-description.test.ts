import { describe, expect, it } from "vitest"
import { buildPaymentDescription } from "./payment-description"

describe("buildPaymentDescription", () => {
  it("nombra una cuota mensual o anual por su mes", () => {
    expect(
      buildPaymentDescription("Pago", "Arriendo", {
        kind: "month",
        on: "2026-10-05"
      })
    ).toBe("Pago Arriendo · octubre")
    expect(
      buildPaymentDescription("Pago", "SOAT", {
        kind: "year",
        on: "2026-06-01"
      })
    ).toBe("Pago SOAT · junio")
  })

  it("distingue las quincenas por el día", () => {
    expect(
      buildPaymentDescription("Ingreso", "Salario", {
        kind: "biweekly",
        on: "2026-11-15"
      })
    ).toBe("Ingreso Salario · 1.ª quincena de noviembre")
    expect(
      buildPaymentDescription("Ingreso", "Salario", {
        kind: "biweekly",
        on: "2026-11-16"
      })
    ).toBe("Ingreso Salario · 2.ª quincena de noviembre")
  })

  it("nombra una cuota por día con el mes corto", () => {
    expect(
      buildPaymentDescription("Ingreso", "Turno", {
        kind: "day",
        on: "2026-11-03"
      })
    ).toBe("Ingreso Turno · 3 nov")
  })

  it("nombra un rango de meses", () => {
    expect(
      buildPaymentDescription("Cobro", "Ana", {
        kind: "range",
        from: "2026-09-01",
        to: "2026-11-01"
      })
    ).toBe("Cobro Ana · septiembre a noviembre")
    expect(
      buildPaymentDescription("Cobro", "Ana", {
        kind: "range",
        from: "2026-11-01",
        to: "2026-11-30"
      })
    ).toBe("Cobro Ana · noviembre")
    expect(
      buildPaymentDescription("Cobro", "Ana", {
        kind: "range",
        from: "2026-11-01",
        to: "2027-01-01"
      })
    ).toBe("Cobro Ana · noviembre a enero")
  })

  it("nombra un rango de días", () => {
    const range = (from: string, to: string) =>
      buildPaymentDescription("Ingreso", "Turno", {
        kind: "range",
        from,
        to,
        unit: "day"
      })

    expect(range("2026-11-01", "2026-11-29")).toBe("Ingreso Turno · 1 a 29 nov")
    expect(range("2026-11-29", "2026-12-06")).toBe(
      "Ingreso Turno · 29 nov a 6 dic"
    )
    expect(range("2026-11-29", "2026-11-29")).toBe("Ingreso Turno · 29 nov")
  })

  it("junta anuales de varios años en su mes", () => {
    expect(
      buildPaymentDescription("Pago", "SOAT", {
        kind: "range",
        from: "2025-06-01",
        to: "2026-06-01",
        unit: "year"
      })
    ).toBe("Pago SOAT · junio")
    expect(
      buildPaymentDescription("Pago", "SOAT", {
        kind: "range",
        from: "2025-06-01",
        to: "2026-08-01",
        unit: "year"
      })
    ).toBe("Pago SOAT · junio a agosto")
  })

  it("sin frecuencia, solo verbo y nombre (recortado)", () => {
    expect(
      buildPaymentDescription("Pago", "  Tarjeta Visa  ", { kind: "none" })
    ).toBe("Pago Tarjeta Visa")
  })
})
