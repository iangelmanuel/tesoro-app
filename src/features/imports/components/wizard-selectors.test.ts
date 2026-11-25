import { describe, expect, it } from "vitest"
import type { SheetCells } from "../read-file"
import {
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  selectedTables,
  sourceTables,
  stepLabel
} from "./wizard-selectors"
import { INITIAL_STATE, wizardReducer } from "./wizard-state"
import type { WizardAction, WizardState } from "./wizard-types"

const MOVEMENTS: SheetCells = {
  name: "Enero",
  cells: [
    ["Fecha", "Tipo", "Monto", "Categoría", "Método"],
    ["05/01/2026", "Gasto", "100", "Comida", "Nequi"],
    ["06/01/2026", "Ingreso", "500", "Sueldo", "Banco"],
    ["07/01/2026", "Traslado", "10", "Otros", ""]
  ]
}

const SAME_HEADERS: SheetCells = {
  name: "Febrero",
  cells: [
    [],
    [null, "fecha", "TIPO", "monto", "categoria", "metodo"],
    [null, "05/02/2026", "Gasto", "50", "Comida", "Nequi"]
  ]
}

// Sin celdas: no tiene tabla
const OTHER: SheetCells = { name: "Vacía", cells: [] }

function run(state: WizardState, ...actions: WizardAction[]) {
  return actions.reduce(wizardReducer, state)
}

const loaded = run(INITIAL_STATE, {
  type: "file_loaded",
  name: "Gastos.XLSX",
  sheets: [OTHER, MOVEMENTS, SAME_HEADERS]
})

describe("stepLabel", () => {
  it("el paso 4 cambia según el destino", () => {
    expect(stepLabel("file", "transactions")).toBe("Archivo")
    expect(stepLabel("categories", "transactions")).toBe("Categorías")
    expect(stepLabel("categories", "debt_entries")).toBe("Deudas")
    expect(stepLabel("categories", "goal_contributions")).toBe("Metas")
  })
})

describe("tablas de las hojas marcadas", () => {
  it("selectedTables busca los mismos encabezados en las demás hojas", () => {
    const state = run(
      loaded,
      { type: "toggle_sheet", sheet: "Febrero" },
      { type: "toggle_sheet", sheet: "Vacía" }
    )
    expect(
      selectedTables(state).map(({ sheet, table }) => [
        sheet.name,
        table?.startCol ?? null
      ])
    ).toEqual([
      ["Vacía", null],
      ["Enero", null],
      ["Febrero", null]
    ])
    // La primera marcada no tiene tabla: no hay tablas de origen
    expect(sourceTables(state)).toEqual([])
  })

  it("con la primera hoja con tabla, las demás se emparejan", () => {
    const state = run(loaded, { type: "toggle_sheet", sheet: "Febrero" })
    expect(
      selectedTables(state).map(({ sheet, table }) => [
        sheet.name,
        table?.startCol ?? null
      ])
    ).toEqual([
      ["Enero", 0],
      ["Febrero", 1]
    ])
    expect(sourceTables(state)).toHaveLength(2)
  })
})

describe("filas leídas por destino", () => {
  const categories = run(loaded, { type: "start_columns" })

  it("los extraídos de movimientos no dan valores de deuda o meta", () => {
    const extracted = extractForTarget(
      "transactions",
      sourceTables(categories),
      categories.config!
    )
    expect(extractedPairs(extracted)).toHaveLength(2)
    expect(extractedAccountValues(extracted)).toHaveLength(2)
    expect(extractedLinkValues(extracted)).toEqual([])
    expect(extractedPairs(null)).toEqual([])
  })
})
