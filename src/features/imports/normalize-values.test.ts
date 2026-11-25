import { describe, expect, it } from "vitest"
import { importSourceFixture } from "@/testing/import-fixtures"
import {
  EMPTY_LINK_LABEL,
  distinctValues,
  isValidAmount,
  linkValue,
  linkValues,
  maxDate,
  noteText,
  parseAmountCell,
  parseDateCell,
  parseIntegerCell,
  readDataRows,
  suggestBySynonyms,
  suggestLinkTargets,
  suggestTypeValue
} from "./normalize"

const TODAY = "2026-11-20"

describe("maxDate", () => {
  it("hoy + 1 año; el 29 de febrero cae al 28", () => {
    expect(maxDate(TODAY)).toBe("2027-11-20")
    expect(maxDate("2028-02-29")).toBe("2029-02-28")
  })
})

describe("parseDateCell", () => {
  it("texto según el formato elegido", () => {
    expect(parseDateCell("05/03/2026", "dmy", TODAY)).toBe("2026-03-05")
    expect(parseDateCell("03/05/2026", "mdy", TODAY)).toBe("2026-03-05")
    expect(parseDateCell("2026-03-05", "ymd", TODAY)).toBe("2026-03-05")
    expect(parseDateCell("5.3.26", "dmy", TODAY)).toBe("2026-03-05")
    expect(parseDateCell("05/03/2026 14:30", "dmy", TODAY)).toBe("2026-03-05")
  })

  it("Date de Excel con componentes UTC y serie numérica", () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 2, 5)), "dmy", TODAY)).toBe(
      "2026-03-05"
    )
    expect(parseDateCell(46_086, "dmy", TODAY)).toBe("2026-03-05")
    expect(parseDateCell(46_086.75, "dmy", TODAY)).toBe("2026-03-05")
  })

  it("rechaza fechas que no existen o fuera de rango", () => {
    expect(parseDateCell("31/02/2026", "dmy", TODAY)).toBeNull()
    expect(parseDateCell("01/01/1999", "dmy", TODAY)).toBeNull()
    expect(parseDateCell("21/11/2027", "dmy", TODAY)).toBeNull()
    expect(parseDateCell("20/11/2027", "dmy", TODAY)).toBe("2027-11-20")
    expect(parseDateCell(100, "dmy", TODAY)).toBeNull()
    expect(parseDateCell("hoy", "dmy", TODAY)).toBeNull()
    expect(parseDateCell(null, "dmy", TODAY)).toBeNull()
  })
})

describe("parseAmountCell", () => {
  it("números se redondean a centavos", () => {
    expect(parseAmountCell(1500.555)).toBe(1500.56)
    expect(parseAmountCell(Number.POSITIVE_INFINITY)).toBeNaN()
  })

  it("texto en es-CO con un solo separador", () => {
    expect(parseAmountCell("50.000")).toBe(50_000)
    expect(parseAmountCell("$ 1.500")).toBe(1500)
    expect(parseAmountCell("12,5")).toBe(12.5)
  })

  it("con coma y punto, el último es el decimal", () => {
    expect(parseAmountCell("1.234,56")).toBe(1234.56)
    expect(parseAmountCell("1,234.56")).toBe(1234.56)
  })

  it("signo al inicio, al final o entre paréntesis", () => {
    expect(parseAmountCell("-50.000")).toBe(-50_000)
    expect(parseAmountCell("50.000-")).toBe(-50_000)
    expect(parseAmountCell("(50.000)")).toBe(-50_000)
    expect(parseAmountCell("(-50.000)")).toBe(50_000)
  })

  it("lo que no es monto da NaN", () => {
    expect(parseAmountCell("abc")).toBeNaN()
    expect(parseAmountCell("1.2.3,4,5")).toBeNaN()
    expect(parseAmountCell(null)).toBeNaN()
  })
})

describe("isValidAmount", () => {
  it("positivo y dentro del tope", () => {
    expect(isValidAmount(1)).toBe(true)
    expect(isValidAmount(0)).toBe(false)
    expect(isValidAmount(-5)).toBe(false)
    expect(isValidAmount(Number.NaN)).toBe(false)
  })
})

describe("sugerencias por sinónimos", () => {
  it("suggestTypeValue", () => {
    expect(suggestTypeValue(" Ingreso ")).toBe("income")
    expect(suggestTypeValue("EGRESO")).toBe("expense")
    expect(suggestTypeValue("otro")).toBeUndefined()
  })

  it("suggestBySynonyms", () => {
    const synonyms = { a: ["uno", "one"], b: ["dos"] }
    expect(suggestBySynonyms("Dos", synonyms)).toBe("b")
    expect(suggestBySynonyms("tres", synonyms)).toBeUndefined()
  })
})

describe("celdas sueltas", () => {
  it("parseIntegerCell", () => {
    expect(parseIntegerCell(15)).toBe(15)
    expect(parseIntegerCell(" 7 ")).toBe(7)
    expect(parseIntegerCell("7.5")).toBeNaN()
    expect(parseIntegerCell(-3)).toBeNaN()
  })

  it("noteText recorta y vacía da null", () => {
    expect(noteText("  hola mundo ", 4)).toBe("hola")
    expect(noteText("   ", 10)).toBeNull()
  })

  it("linkValue con celda vacía", () => {
    expect(linkValue(" Tarjeta Visa ")).toEqual({
      key: "tarjeta visa",
      label: "Tarjeta Visa"
    })
    expect(linkValue(null)).toEqual({
      key: "(vacio)",
      label: EMPTY_LINK_LABEL
    })
  })
})

describe("readDataRows y distinctValues", () => {
  const table = importSourceFixture(
    ["Nombre", "Monto", "Nota"],
    [
      ["Netflix", "40.000", null],
      [null, null, "solo nota"],
      ["netflix ", "40.000", null],
      ["Gym", "90.000", null]
    ]
  )

  it("readDataRows entrega las filas con algún campo requerido", () => {
    const { rows, empty } = readDataRows([table], { name: 0, amount: 1 }, [
      "name",
      "amount"
    ])
    expect(empty).toBe(1)
    expect(rows.map((row) => [row.sourceRow, row.at("name")])).toEqual([
      [2, "Netflix"],
      [4, "netflix "],
      [5, "Gym"]
    ])
    expect(rows[0].at("frequency")).toBeNull()
  })

  it("distinctValues agrupa por texto normalizado", () => {
    expect(distinctValues([table], 0)).toEqual([
      { key: "netflix", label: "Netflix", count: 2 },
      { key: "", label: "", count: 1 },
      { key: "gym", label: "Gym", count: 1 }
    ])
  })
})

describe("deuda o meta por fila", () => {
  it("linkValues y suggestLinkTargets", () => {
    const values = linkValues([
      { value: { linkKey: "visa", linkLabel: "Visa" } },
      { value: { linkKey: "visa", linkLabel: "VISA" } },
      { value: { linkKey: null, linkLabel: "" } }
    ])
    expect(values).toEqual([{ key: "visa", label: "Visa", count: 2 }])
    expect(
      suggestLinkTargets(
        [...values, { key: "otro", label: "Otro" }],
        [{ id: "d1", name: "visa" }]
      )
    ).toEqual({
      visa: { kind: "existing", id: "d1" },
      otro: { kind: "skip" }
    })
  })
})
