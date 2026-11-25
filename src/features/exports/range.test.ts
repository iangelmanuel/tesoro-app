import { describe, expect, it } from "vitest"
import {
  PDF_MONTHS_ERROR,
  exportFileName,
  formatGenerated,
  monthLabel,
  monthTitle,
  parseExportRange,
  parsePdfOptions,
  previousRange,
  slugify
} from "./range"

const TODAY = "2026-11-20"

describe("parsePdfOptions", () => {
  it("ausentes toman el valor por defecto", () => {
    expect(
      parsePdfOptions({ size: null, orientation: null, theme: null })
    ).toEqual({
      success: true,
      options: { size: "a4", orientation: "portrait", theme: "color" }
    })
  })

  it("un valor fuera de la lista es error", () => {
    expect(
      parsePdfOptions({ size: "a3", orientation: null, theme: null })
    ).toEqual({ success: false, error: "Las opciones del PDF no son válidas" })
  })
})

describe("parseExportRange", () => {
  it("rango válido con la lista de meses", () => {
    expect(parseExportRange("2025-11", "2026-02", TODAY)).toEqual({
      success: true,
      range: {
        from: "2025-11",
        to: "2026-02",
        months: ["2025-11", "2025-12", "2026-01", "2026-02"]
      }
    })
  })

  it("rechaza meses mal formados, invertidos o futuros", () => {
    expect(parseExportRange("2026-13", "2026-01", TODAY)).toEqual({
      success: false,
      error: "Los meses del periodo no son válidos"
    })
    expect(parseExportRange("2026-03", "2026-01", TODAY)).toEqual({
      success: false,
      error: "El mes inicial es posterior al mes final"
    })
    expect(parseExportRange("2026-11", "2026-12", TODAY)).toEqual({
      success: false,
      error: "El periodo no puede terminar después del mes actual"
    })
  })

  it("tope de 12 meses en PDF y de 36 en Excel y CSV", () => {
    expect(parseExportRange("2025-11", "2026-11", TODAY, "pdf")).toEqual({
      success: false,
      error: PDF_MONTHS_ERROR
    })
    expect(parseExportRange("2025-12", "2026-11", TODAY, "pdf").success).toBe(
      true
    )
    expect(parseExportRange("2023-12", "2026-11", TODAY, "csv").success).toBe(
      true
    )
    expect(parseExportRange("2023-11", "2026-11", TODAY)).toEqual({
      success: false,
      error: "El periodo no puede cubrir más de 36 meses."
    })
  })
})

describe("previousRange", () => {
  it("los N meses justo antes", () => {
    expect(
      previousRange({ from: "2026-01", months: ["2026-01", "2026-02"] })
    ).toEqual({ from: "2025-11", to: "2025-12" })
  })
})

describe("etiquetas", () => {
  it("monthLabel y monthTitle", () => {
    expect(monthLabel("2026-10")).toBe("Octubre 2026")
    expect(monthTitle("2026-10", TODAY)).toBe("Octubre 2026")
    expect(monthTitle("2026-11", TODAY)).toBe("Noviembre 2026 (en curso)")
  })

  it("formatGenerated", () => {
    expect(formatGenerated("2026-11-06")).toBe("6 nov 2026")
    expect(formatGenerated("2026-09-30")).toBe("30 sept 2026")
  })
})

describe("nombre del archivo", () => {
  it("slugify quita tildes y corta en 40", () => {
    expect(slugify("  Panadería Ñandú & Cía.  ")).toBe("panaderia-nandu-cia")
    expect(slugify("¡¡!!")).toBe("empresa")
    expect(slugify("a".repeat(39) + " bc")).toBe("a".repeat(39))
  })

  it("periodo: un mes, un año completo o un rango", () => {
    const personal = { type: "personal" as const, name: "Personal" }
    const business = { type: "business" as const, name: "Mi Tienda" }
    expect(
      exportFileName(personal, { from: "2026-10", to: "2026-10" }, "xlsx")
    ).toBe("tesoro-personal-2026-10.xlsx")
    expect(
      exportFileName(business, { from: "2025-01", to: "2025-12" }, "pdf")
    ).toBe("tesoro-mi-tienda-2025.pdf")
    expect(
      exportFileName(business, { from: "2025-03", to: "2025-12" }, "csv")
    ).toBe("tesoro-mi-tienda-2025-03_2025-12.csv")
  })
})
