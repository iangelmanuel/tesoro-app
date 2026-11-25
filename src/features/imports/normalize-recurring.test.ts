import { describe, expect, it } from "vitest"
import {
  importConfigFixture,
  importSourceFixture
} from "@/testing/import-fixtures"
import {
  buildRecurringPreviewRows,
  extractRecurringRows,
  parseMonthCell,
  suggestFrequencyValue
} from "./normalize-recurring"

const TODAY = "2026-11-20"

describe("parseMonthCell y suggestFrequencyValue", () => {
  it("mes por número o nombre", () => {
    expect(parseMonthCell(3)).toBe(3)
    expect(parseMonthCell("Septiembre")).toBe(9)
    expect(parseMonthCell("13")).toBeNaN()
    expect(parseMonthCell("mar")).toBeNaN()
  })

  it("frecuencia por sinónimos", () => {
    expect(suggestFrequencyValue("Mensual")).toBe("monthly")
    expect(suggestFrequencyValue("Año")).toBe("yearly")
    expect(suggestFrequencyValue("semanal")).toBeUndefined()
  })
})

describe("extractRecurringRows sin columnas opcionales", () => {
  const { rows, empty } = extractRecurringRows(
    [
      importSourceFixture(
        ["Nombre", "Monto", "Nota"],
        [
          ["Netflix", "40.000", null],
          [null, null, "x"],
          ["", "abc", null]
        ]
      )
    ],
    importConfigFixture({ mapping: { name: 0, amount: 1 } }),
    TODAY
  )

  it("mensual desde el primer día del mes, categoría del sistema", () => {
    expect(rows[0]).toEqual({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready",
      reasons: [],
      value: {
        type: "expense",
        name: "Netflix",
        amount: 40_000,
        frequency: "monthly",
        day_of_month: 1,
        month_of_year: null,
        starts_on: "2026-11-01",
        ends_on: null,
        pairKey: "expense:otros gastos",
        categoryLabel: "Otros gastos"
      }
    })
    expect(empty).toBe(1)
  })

  it("sin nombre y monto inválido", () => {
    expect(rows[1]).toMatchObject({
      status: "error",
      reasons: ["Falta el nombre", "Monto inválido"]
    })
  })
})

describe("extractRecurringRows con todas las columnas", () => {
  const long = "n".repeat(70)
  const { rows } = extractRecurringRows(
    [
      importSourceFixture(
        [
          "Nombre",
          "Monto",
          "Categoría",
          "Frecuencia",
          "Día",
          "Mes",
          "Inicio",
          "Fin"
        ],
        [
          [
            "Seguro",
            "1.200.000",
            "Seguros",
            "Anual",
            "15",
            "",
            "10/03/2026",
            ""
          ],
          [long, "10", "", "Mensual", "40", "", "01/01/2026", "01/12/2025"],
          ["Club", "10", "Ocio", "Semanal", "5", "", "01/01/2026", ""],
          ["Gym", "10", "Ocio", "Omitir", "5", "", "01/01/2026", ""],
          ["Predial", "10", "Casa", "Anual", "5", "abril", "01/01/2026", ""]
        ]
      )
    ],
    importConfigFixture({
      mapping: {
        name: 0,
        amount: 1,
        category: 2,
        frequency: 3,
        day_of_month: 4,
        month_of_year: 5,
        starts_on: 6,
        ends_on: 7
      },
      frequencyValues: {
        anual: "yearly",
        mensual: "monthly",
        omitir: "skip"
      }
    }),
    TODAY
  )

  it("anual sin mes toma el de la fecha de inicio", () => {
    expect(rows[0].value).toMatchObject({
      frequency: "yearly",
      day_of_month: 15,
      month_of_year: 3,
      starts_on: "2026-03-10",
      categoryLabel: "Seguros"
    })
    expect(rows[4].value).toMatchObject({ month_of_year: 4 })
  })

  it("día inválido y fin antes del inicio", () => {
    expect(rows[1]).toMatchObject({
      status: "error",
      reasons: ["Día inválido", "El fin es antes del inicio"]
    })
  })

  it("frecuencia desconocida y omitida", () => {
    expect(rows[2]).toMatchObject({
      status: "error",
      reasons: ["Frecuencia desconocida"]
    })
    expect(rows[3]).toMatchObject({
      status: "skipped",
      reasons: ["Frecuencia «Omitir» marcada como Omitir fila"]
    })
  })

  it("vista previa con categorías", () => {
    const preview = buildRecurringPreviewRows(rows, {
      "expense:seguros": { kind: "existing", categoryId: "c1" },
      "expense:casa": { kind: "skip" }
    })
    expect(preview[0]).toMatchObject({
      selected: true,
      value: { name: "Seguro", categoryKey: "existing:c1" }
    })
    expect(preview[0].value).not.toHaveProperty("pairKey")
    expect(preview[4]).toMatchObject({
      status: "skipped",
      reasons: ["Categoría «Casa» marcada como No importar"]
    })
  })
})
