import { describe, expect, it } from "vitest"
import {
  AMOUNT_MASK,
  currencySymbol,
  formatCompactCount,
  formatCurrency,
  formatDate,
  formatMonthTitle,
  formatMonthYear,
  formatNumber,
  formatPercent,
  formatPercentLabel,
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

describe("formatNumber", () => {
  it("usa miles con punto y hasta tres decimales por defecto", () => {
    expect(formatNumber(1500000)).toBe("1.500.000")
    expect(formatNumber(1.23456)).toBe("1,235")
    expect(formatNumber(-0.5)).toBe("-0,5")
  })

  it("respeta las opciones de decimales y de miles", () => {
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 })).toBe("1.234,5")
    expect(formatNumber(5, { minimumFractionDigits: 2 })).toBe("5,00")
    expect(formatNumber(1500.25, { useGrouping: false })).toBe("1500,25")
  })
})

describe("formatPercent", () => {
  it("recibe la escala 0–100 y deja un decimal", () => {
    expect(formatPercent(12.34)).toBe("12,3%")
    expect(formatPercent(0)).toBe("0%")
    expect(formatPercent(100)).toBe("100%")
    expect(formatPercent(-5.55)).toBe("-5,6%")
  })
})

describe("formatPercentLabel", () => {
  it("separa el signo con un espacio duro", () => {
    expect(formatPercentLabel(93)).toBe(`93${NBSP}%`)
    expect(formatPercentLabel(0)).toBe(`0${NBSP}%`)
  })
})

describe("formatCompactCount", () => {
  it("abrevia con la notación compacta de Intl", () => {
    expect(formatCompactCount(999)).toBe("999")
    expect(formatCompactCount(1234)).toBe(`1,2${NBSP}K`)
    expect(formatCompactCount(15000)).toBe(`15${NBSP}k`)
    expect(formatCompactCount(2500000)).toBe(`2,5${NBSP}M`)
  })
})

describe("currencySymbol", () => {
  it("da el símbolo corto de la moneda", () => {
    expect(currencySymbol("COP")).toBe("$")
    expect(currencySymbol("USD")).toBe("$")
    expect(currencySymbol("EUR")).toBe("€")
  })
})

describe("formatMonthTitle", () => {
  it("nombra el mes con mayúscula inicial, como lo da Intl", () => {
    expect(formatMonthTitle("2026-11")).toBe("Noviembre de 2026")
    expect(formatMonthTitle("2027-01")).toBe("Enero de 2027")
  })
})

describe("formatMonthYear", () => {
  it("nombra el mes en minúscula con su año", () => {
    expect(formatMonthYear("2026-11")).toBe("noviembre 2026")
    expect(formatMonthYear("2027-01")).toBe("enero 2027")
  })
})
