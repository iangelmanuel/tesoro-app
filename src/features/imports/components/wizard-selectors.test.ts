import { describe, expect, it } from "vitest"
import { importConfigFixture } from "@/testing/import-fixtures"
import type { SheetCells } from "../read-file"
import {
  accountNamesFor,
  categoryNamesFor,
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  hasLinkedPayments,
  linkFieldOf,
  linkedIds,
  previewBackStep,
  selectedTables,
  sourceTables,
  stepLabel
} from "./wizard-selectors"
import { INITIAL_STATE, wizardReducer } from "./wizard-state"
import type { PreviewState, WizardAction, WizardState } from "./wizard-types"

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

describe("helpers de la vista previa", () => {
  it("linkedIds sin repetir", () => {
    expect(
      linkedIds(
        [
          { value: { id: "a" } },
          {},
          { value: { id: "a" } },
          { value: { id: "b" } }
        ],
        (value) => value.id
      )
    ).toEqual(["a", "b"])
  })

  it("accountNamesFor solo con la columna Método", () => {
    const config = importConfigFixture({ mapping: { account: 4 } })
    expect(
      accountNamesFor(
        {
          config,
          accountTargets: {
            banco: { kind: "new", name: "Banco" },
            "": { kind: "none" }
          }
        },
        [{ id: "a1", name: "Nequi" }]
      )
    ).toEqual({ "existing:a1": "Nequi", "new:banco": "Banco (nueva)" })
    expect(
      accountNamesFor(
        { config: importConfigFixture({}), accountTargets: {} },
        []
      )
    ).toBeUndefined()
  })

  it("categoryNamesFor con las nuevas de los pares", () => {
    expect(
      categoryNamesFor(
        [{ id: "c1", type: "expense", name: "Comida" }],
        [{ key: "expense:ocio", type: "expense", label: "Ocio", count: 1 }],
        { "expense:ocio": { kind: "new", name: "Ocio" } }
      )
    ).toEqual({ "existing:c1": "Comida", "new:expense:ocio": "Ocio (nueva)" })
  })

  it("hasLinkedPayments ignora tarjetas y filas desmarcadas", () => {
    const row = (debtId: string, selected = true) => ({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready" as const,
      reasons: [],
      selected,
      value: {
        debtId,
        kind: "payment" as const,
        amount: 10,
        occurred_on: "2026-01-01",
        note: null
      }
    })
    const debts = [
      { id: "card", kind: "credit_card" as const },
      { id: "loan", kind: "loan" as const }
    ]
    const preview = (rows: ReturnType<typeof row>[]): PreviewState => ({
      target: "debt_entries",
      empty: 0,
      rows
    })
    expect(hasLinkedPayments(preview([row("card")]), debts)).toBe(false)
    expect(hasLinkedPayments(preview([row("loan", false)]), debts)).toBe(false)
    expect(hasLinkedPayments(preview([row("loan")]), debts)).toBe(true)
    expect(hasLinkedPayments(null, debts)).toBe(false)
  })

  it("linkFieldOf y previewBackStep", () => {
    expect(linkFieldOf("debt_entries")).toBe("debt")
    expect(linkFieldOf("goal_contributions")).toBe("goal")
    expect(linkFieldOf("transactions")).toBeNull()
    expect(previewBackStep("transactions", null)).toBe("categories")
    expect(
      previewBackStep("debt_entries", importConfigFixture({ mapping: {} }))
    ).toBe("columns")
    expect(
      previewBackStep(
        "goal_contributions",
        importConfigFixture({ mapping: { goal: 3 } })
      )
    ).toBe("categories")
  })
})
