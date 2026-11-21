import { describe, expect, it } from "vitest"
import {
  AMOUNT_MASK,
  formatCurrency,
  formatDate,
  formatShortDate,
  formatTime
} from "./format"

// Intl en es-CO separa con espacio duro (U+00A0)
const NBSP = String.fromCharCode(0xa0)

describe("formatCurrency", () => {
  it("muestra COP sin decimales y con separador de miles", () => {
    expect(formatCurrency(1500000)).toBe(`$${NBSP}1.500.000`)
    expect(formatCurrency(0)).toBe(`$${NBSP}0`)
  })

  it("redondea los centavos en COP y CLP", () => {
    expect(formatCurrency(-1234.5)).toBe(`-$${NBSP}1.235`)
    expect(formatCurrency(99.5, "CLP")).toBe(`CLP${NBSP}100`)
  })

  it("usa dos decimales en el resto de monedas", () => {
    expect(formatCurrency(1234.5, "USD")).toBe(`US$${NBSP}1.234,50`)
    expect(formatCurrency(10, "EUR")).toBe(`EUR${NBSP}10,00`)
  })

  it("respeta `fractionDigits` cuando se pasa", () => {
    expect(formatCurrency(1234.567, "COP", 2)).toBe(`$${NBSP}1.234,57`)
  })
})

describe("formatDate", () => {
  it("formatea una fecha de Postgres sin correr el día", () => {
    expect(formatDate("2026-01-05")).toBe(
      `5${NBSP}de${NBSP}ene${NBSP}de${NBSP}2026`
    )
  })

  it("formatea un Date en UTC", () => {
    expect(formatDate(new Date("2026-12-31T23:00:00Z"))).toBe(
      `31${NBSP}de${NBSP}dic${NBSP}de${NBSP}2026`
    )
  })
})

describe("formatShortDate", () => {
  it("omite el año", () => {
    expect(formatShortDate("2026-11-01")).toBe(`1${NBSP}de${NBSP}nov`)
  })
})

describe("formatTime", () => {
  it("da la hora en 12 h con a. m. / p. m.", () => {
    expect(formatTime("14:30")).toBe(`2:30${NBSP}p.${NBSP}m.`)
    expect(formatTime("09:07")).toBe(`9:07${NBSP}a.${NBSP}m.`)
    expect(formatTime("12:00")).toBe(`12:00${NBSP}p.${NBSP}m.`)
  })

  it("acepta segundos de Postgres", () => {
    expect(formatTime("00:05:00")).toBe(`12:05${NBSP}a.${NBSP}m.`)
  })
})

describe("AMOUNT_MASK", () => {
  it("es la máscara de cifras ocultas", () => {
    expect(AMOUNT_MASK).toBe("***")
  })
})
