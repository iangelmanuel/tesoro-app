import { describe, expect, it } from "vitest"
import {
  buildTable,
  cellText,
  columnName,
  detectTables,
  isEmptyCell,
  matchTable,
  normalizeText,
  suggestMapping,
  suggestTypeMode,
  tableBodyRows,
  tableRowCells
} from "./detect"

describe("normalizeText", () => {
  it("minúsculas, sin tildes y espacios colapsados", () => {
    expect(normalizeText("  Descripción   del  Gasto ")).toBe(
      "descripcion del gasto"
    )
    expect(normalizeText("Año")).toBe("ano")
  })
})

describe("celdas", () => {
  it("isEmptyCell", () => {
    expect(isEmptyCell(null)).toBe(true)
    expect(isEmptyCell(undefined)).toBe(true)
    expect(isEmptyCell("   ")).toBe(true)
    expect(isEmptyCell(0)).toBe(false)
  })

  it("cellText", () => {
    expect(cellText(null)).toBe("")
    expect(cellText(" hola ")).toBe("hola")
    expect(cellText(1500)).toBe("1500")
    expect(cellText(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05")
  })

  it("columnName como en Excel", () => {
    expect(columnName(0)).toBe("A")
    expect(columnName(8)).toBe("I")
    expect(columnName(26)).toBe("AA")
  })
})

// Una hoja con un título, una tabla en B3 y una fila vacía en medio
const SHEET: unknown[][] = [
  ["Mis gastos"],
  [],
  [null, "Fecha", "Descripción", "Categoría", "Monto"],
  [null, "05/03/2026", "Mercado", "Comida", "50.000"],
  [],
  [null, "06/03/2026", "Bus", "Transporte", "-2.500"],
  [],
  [],
  [],
  [null, "Total", null, null, "52.500"]
]

describe("detectTables", () => {
  it("encuentra la tabla por encabezados y una fila de datos", () => {
    expect(detectTables(SHEET, "Hoja1")).toEqual([
      {
        sheet: "Hoja1",
        headerRow: 2,
        startCol: 1,
        endCol: 4,
        headers: ["Fecha", "Descripción", "Categoría", "Monto"]
      }
    ])
  })

  it("sin tabla reconocible usa la fila 1 con todas las columnas", () => {
    expect(
      detectTables(
        [
          ["a", "b"],
          [1, 2]
        ],
        "Hoja1"
      )
    ).toEqual([
      {
        sheet: "Hoja1",
        headerRow: 0,
        startCol: 0,
        endCol: 1,
        headers: ["a", "b"]
      }
    ])
  })

  it("hoja vacía no da tablas", () => {
    expect(detectTables([[], [null]], "Hoja1")).toEqual([])
  })
})

describe("filas de la tabla", () => {
  const table = detectTables(SHEET, "Hoja1")[0]

  it("tableBodyRows salta vacías y termina tras 3 seguidas", () => {
    expect(tableBodyRows(SHEET, table)).toEqual([3, 5])
  })

  it("tableRowCells alinea con los encabezados", () => {
    expect(tableRowCells(SHEET, table, 3)).toEqual([
      "05/03/2026",
      "Mercado",
      "Comida",
      "50.000"
    ])
  })

  it("buildTable nombra los encabezados vacíos", () => {
    expect(buildTable(SHEET, "Hoja1", 2, 0, 1).headers).toEqual([
      "Columna A",
      "Fecha"
    ])
  })
})

describe("matchTable", () => {
  it("encuentra la tabla con los mismos encabezados en otra columna", () => {
    const reference = detectTables(SHEET, "Hoja1")[0]
    const other = [["FECHA", "descripcion", "Categoria", "monto"]]
    expect(matchTable(other, "Hoja2", reference)).toMatchObject({
      sheet: "Hoja2",
      headerRow: 0,
      startCol: 0,
      endCol: 3
    })
  })

  it("sin coincidencia da null", () => {
    const reference = detectTables(SHEET, "Hoja1")[0]
    expect(matchTable([["x", "y", "z", "w"]], "Hoja2", reference)).toBeNull()
  })
})

describe("suggestMapping y suggestTypeMode", () => {
  it("cada campo toma el primer encabezado que coincide", () => {
    const mapping = suggestMapping([
      "Fecha",
      "Concepto",
      "Ingreso",
      "Gasto",
      "Método"
    ])
    expect(mapping).toEqual({
      date: 0,
      description: 1,
      income_amount: 2,
      expense_amount: 3,
      account: 4
    })
    expect(suggestTypeMode(mapping)).toBe("split")
  })

  it("con columna de tipo quita ingreso y gasto", () => {
    const mapping = suggestMapping(["Fecha", "Tipo", "Monto", "Entrada"])
    expect(mapping).toEqual({ date: 0, type: 1, amount: 2 })
    expect(suggestTypeMode(mapping)).toBe("column")
  })

  it("solo monto: por signo", () => {
    expect(suggestTypeMode(suggestMapping(["Fecha", "Valor"]))).toBe("sign")
  })

  it("usa los sinónimos del destino", () => {
    expect(
      suggestMapping(["Nombre", "Cuota", "Frecuencia"], "recurring_expenses")
    ).toMatchObject({ name: 0, amount: 1, frequency: 2 })
  })
})
