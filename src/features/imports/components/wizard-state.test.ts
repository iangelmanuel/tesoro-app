import { describe, expect, it } from "vitest"
import type { SheetCells } from "../read-file"
import type { PreviewRow } from "../types"
import {
  INITIAL_STATE,
  type PreviewState,
  type WizardAction,
  type WizardState,
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  initialState,
  selectedTables,
  sourceTables,
  stepLabel,
  wizardReducer
} from "./wizard-state"

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

describe("archivo y hojas", () => {
  it("marca la primera hoja con tabla", () => {
    expect(loaded.step).toBe("table")
    expect(loaded.file?.isCsv).toBe(false)
    expect(loaded.selectedSheets).toEqual(["Enero"])
    expect(loaded.primaryTable).toMatchObject({ sheet: "Enero", headerRow: 0 })
  })

  it("toggle_sheet conserva el orden del archivo y la tabla principal", () => {
    const both = run(loaded, { type: "toggle_sheet", sheet: "Febrero" })
    expect(both.selectedSheets).toEqual(["Enero", "Febrero"])
    expect(both.primaryTable).toBe(loaded.primaryTable)

    const onlySecond = run(both, { type: "toggle_sheet", sheet: "Enero" })
    expect(onlySecond.selectedSheets).toEqual(["Febrero"])
    expect(onlySecond.primaryTable).toMatchObject({
      sheet: "Febrero",
      headerRow: 1,
      startCol: 1
    })
  })

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

describe("columnas", () => {
  const columns = run(loaded, { type: "start_columns" })

  it("sugiere el mapeo, el modo y los valores de tipo", () => {
    expect(columns.step).toBe("columns")
    expect(columns.config).toEqual({
      mapping: { date: 0, type: 1, amount: 2, category: 3, account: 4 },
      typeMode: "column",
      dateFormat: "dmy",
      typeValues: { gasto: "expense", ingreso: "income" },
      entryTypeMode: "sign",
      entryTypeValues: {},
      frequencyValues: {},
      fixedLinkId: null
    })
  })

  it("con los mismos encabezados conserva la configuración", () => {
    const edited = run(
      columns,
      { type: "set_date_format", format: "mdy" },
      { type: "go_to", step: "table" },
      { type: "start_columns" }
    )
    expect(edited.config?.dateFormat).toBe("mdy")
  })

  it("set_field deja cada columna en un solo campo", () => {
    const moved = run(columns, {
      type: "set_field",
      field: "description",
      column: 3
    })
    expect(moved.config?.mapping).toEqual({
      date: 0,
      type: 1,
      amount: 2,
      description: 3,
      account: 4
    })
    const cleared = run(moved, {
      type: "set_field",
      field: "account",
      column: undefined
    })
    expect(cleared.config?.mapping).not.toHaveProperty("account")
  })

  it("set_type_value agrega y quita destinos", () => {
    const withSkip = run(columns, {
      type: "set_type_value",
      key: "traslado",
      target: "skip"
    })
    expect(withSkip.config?.typeValues.traslado).toBe("skip")
    const without = run(withSkip, {
      type: "set_type_value",
      key: "gasto",
      target: undefined
    })
    expect(without.config?.typeValues).toEqual({
      ingreso: "income",
      traslado: "skip"
    })
  })

  it("sin config las acciones de columnas no cambian nada", () => {
    expect(run(loaded, { type: "set_type_mode", mode: "sign" })).toBe(loaded)
    expect(run(loaded, { type: "set_fixed_link", id: "d1" })).toBe(loaded)
  })
})

describe("categorías y cuentas", () => {
  const categories = run(
    loaded,
    { type: "start_columns" },
    {
      type: "start_categories",
      categories: [{ id: "c1", type: "expense", name: "comida" }],
      accounts: [{ id: "a1", name: "Nequi" }]
    }
  )

  it("sugiere destinos para pares y valores de Método", () => {
    expect(categories.step).toBe("categories")
    expect(categories.categoryTargets).toEqual({
      "expense:comida": { kind: "existing", categoryId: "c1" },
      "income:sueldo": { kind: "new", name: "Sueldo" }
    })
    expect(categories.accountTargets).toEqual({
      nequi: { kind: "existing", accountId: "a1" },
      banco: { kind: "new", name: "Banco" }
    })
  })

  it("al volver conserva lo elegido", () => {
    const again = run(
      categories,
      {
        type: "set_category_target",
        key: "expense:comida",
        target: { kind: "skip" }
      },
      {
        type: "start_categories",
        categories: [{ id: "c1", type: "expense", name: "comida" }],
        accounts: []
      }
    )
    expect(again.categoryTargets["expense:comida"]).toEqual({ kind: "skip" })
  })

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

describe("deudas", () => {
  const debtSheet: SheetCells = {
    name: "Pagos",
    cells: [
      ["Fecha", "Tipo", "Monto", "Deuda"],
      ["05/01/2026", "Pago", "100", "Visa"],
      ["06/01/2026", "Compra", "50", "Otra"]
    ]
  }
  const links = run(
    initialState("debt_entries"),
    { type: "file_loaded", name: "pagos.csv", sheets: [debtSheet] },
    { type: "start_columns" },
    { type: "start_links", options: [{ id: "d1", name: "VISA" }] }
  )

  it("el destino se conserva al cargar el archivo", () => {
    expect(links.target).toBe("debt_entries")
    expect(links.file?.isCsv).toBe(true)
  })

  it("sugiere tipos de fila y deudas", () => {
    expect(links.config).toMatchObject({
      mapping: { date: 0, entry_type: 1, amount: 2, debt: 3 },
      entryTypeMode: "column",
      entryTypeValues: { pago: "payment", compra: "charge" }
    })
    expect(links.linkTargets).toEqual({
      visa: { kind: "existing", id: "d1" },
      otra: { kind: "skip" }
    })
  })
})

describe("vista previa, resumen y reinicio", () => {
  const row = (selected: boolean, withValue = true): PreviewRow<unknown> => ({
    sheet: "Enero",
    sourceRow: 2,
    status: withValue ? "ready" : "error",
    reasons: [],
    selected,
    value: withValue ? {} : undefined
  })
  const preview = {
    target: "transactions",
    empty: 0,
    rows: [row(true), row(false, false)]
  } as PreviewState
  const ready = run(loaded, { type: "preview_ready", preview })

  it("toggle_row solo cambia filas con datos", () => {
    const toggled = run(ready, { type: "toggle_row", index: 0 })
    expect(toggled.preview?.rows[0].selected).toBe(false)
    expect(run(ready, { type: "toggle_row", index: 1 })).toBe(ready)
  })

  it("imported pasa al resumen y reset conserva el destino", () => {
    const stats = { read: 1, imported: 1, skipped: 0, duplicates: 0, errors: 0 }
    const done = run(ready, { type: "imported", stats })
    expect(done).toMatchObject({ step: "summary", summary: stats })

    const other = run(
      done,
      { type: "set_target", target: "recurring_expenses" },
      { type: "reset" }
    )
    expect(other).toEqual(initialState("recurring_expenses"))
  })

  it("set_target al mismo destino no cambia el estado", () => {
    expect(run(ready, { type: "set_target", target: "transactions" })).toBe(
      ready
    )
  })
})
