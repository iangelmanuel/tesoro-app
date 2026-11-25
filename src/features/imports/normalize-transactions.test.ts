import { describe, expect, it } from "vitest"
import {
  importConfigFixture,
  importSourceFixture
} from "@/testing/import-fixtures"
import {
  accountValues,
  buildPreviewRows,
  categoryKeyFor,
  categoryPairs,
  computeStats,
  countDataRows,
  extractRows,
  newAccounts,
  newCategories,
  pairKey,
  suggestAccountTargets,
  suggestCategoryTargets,
  toImportRows,
  toTransactionImportRows
} from "./normalize"
import type { PreviewRow } from "./types"

const TODAY = "2026-11-20"

describe("extractRows por signo", () => {
  const table = importSourceFixture(
    ["Fecha", "Descripción", "Categoría", "Monto", "Método"],
    [
      ["05/03/2026", "Mercado", "Comida", "-50.000", "Nequi"],
      ["06/03/2026", "Sueldo", "Salario", "2.000.000", ""],
      [null, "Solo descripción", null, null, null],
      ["31/02/2026", "", "", "abc", null]
    ]
  )
  const result = extractRows(
    [table],
    importConfigFixture({
      mapping: { date: 0, description: 1, category: 2, amount: 3, account: 4 }
    }),
    TODAY
  )

  it("lee tipo, monto, categoría y cuenta", () => {
    expect(result.rows[0]).toEqual({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready",
      reasons: [],
      value: {
        type: "expense",
        amount: 50_000,
        occurred_on: "2026-03-05",
        pairKey: "expense:comida",
        categoryLabel: "Comida",
        description: "Mercado",
        note: null,
        accountLabel: "Nequi"
      }
    })
    expect(result.rows[1].value).toMatchObject({
      type: "income",
      amount: 2_000_000,
      accountLabel: ""
    })
  })

  it("sin fecha ni monto cuenta como vacía; los errores llevan motivos", () => {
    expect(result.empty).toBe(1)
    expect(result.rows[2]).toEqual({
      sheet: "Hoja1",
      sourceRow: 5,
      status: "error",
      reasons: ["Fecha inválida", "Monto inválido", "Falta la descripción"]
    })
  })

  it("countDataRows cuenta las filas con datos", () => {
    expect(
      countDataRows(
        [table],
        importConfigFixture({ mapping: { date: 0, description: 1, amount: 3 } })
      )
    ).toBe(3)
  })
})

describe("extractRows por columna de tipo", () => {
  const table = importSourceFixture(
    ["Fecha", "Tipo", "Monto", "Concepto"],
    [
      ["05/03/2026", "Gasto", "100", "Pan"],
      ["05/03/2026", "Traslado", "100", "X"],
      ["05/03/2026", "Raro", "100", "Y"]
    ]
  )
  const result = extractRows(
    [table],
    importConfigFixture({
      mapping: { date: 0, type: 1, amount: 2, description: 3 },
      typeMode: "column",
      typeValues: { gasto: "expense", traslado: "skip" }
    }),
    TODAY
  )

  it("sin columna de categoría usa la del sistema", () => {
    expect(result.rows[0].value).toMatchObject({
      type: "expense",
      amount: 100,
      categoryLabel: "Otros gastos",
      pairKey: "expense:otros gastos"
    })
  })

  it("valor omitido y valor desconocido", () => {
    expect(result.rows[1]).toMatchObject({
      status: "skipped",
      reasons: ["Tipo «Traslado» marcado como Omitir fila"]
    })
    expect(result.rows[2]).toMatchObject({
      status: "error",
      reasons: ["Tipo desconocido"]
    })
  })
})

describe("extractRows con dos columnas de monto", () => {
  const long = "a".repeat(130)
  const table = importSourceFixture(
    ["Fecha", "Entrada", "Salida", "Categoría", "Descripción", "Nota"],
    [
      ["05/03/2026", "100", "", "Ventas", "", "nota"],
      ["05/03/2026", "100", "50", "X", "Y", null],
      ["05/03/2026", "", "30", "", long, null]
    ]
  )
  const result = extractRows(
    [table],
    importConfigFixture({
      mapping: {
        date: 0,
        income_amount: 1,
        expense_amount: 2,
        category: 3,
        description: 4,
        note: 5
      },
      typeMode: "split"
    }),
    TODAY
  )

  it("descripción vacía toma la categoría; la nota va aparte", () => {
    expect(result.rows[0].value).toMatchObject({
      type: "income",
      amount: 100,
      description: "Ventas",
      note: "nota"
    })
  })

  it("entrada y salida a la vez es error", () => {
    expect(result.rows[1]).toMatchObject({
      status: "error",
      reasons: ["Entrada y salida a la vez"]
    })
  })

  it("categoría vacía y descripción recortada con aviso", () => {
    expect(result.rows[2]).toMatchObject({
      status: "ready",
      reasons: ["Descripción recortada a 120 caracteres"],
      value: {
        type: "expense",
        categoryLabel: "Sin categoría",
        description: "a".repeat(120)
      }
    })
  })
})

describe("categorías", () => {
  const rows = [
    {
      value: {
        type: "expense" as const,
        pairKey: pairKey("expense", "Comida"),
        categoryLabel: "Comida"
      }
    },
    {
      value: {
        type: "expense" as const,
        pairKey: pairKey("expense", "comída"),
        categoryLabel: "comída"
      }
    },
    {
      value: {
        type: "income" as const,
        pairKey: pairKey("income", "Bonos"),
        categoryLabel: "Bonos"
      }
    },
    {}
  ]

  it("categoryPairs agrupa por tipo y nombre normalizado", () => {
    expect(categoryPairs(rows)).toEqual([
      { key: "expense:comida", type: "expense", label: "Comida", count: 2 },
      { key: "income:bonos", type: "income", label: "Bonos", count: 1 }
    ])
  })

  it("suggestCategoryTargets busca por tipo y nombre", () => {
    const pairs = categoryPairs(rows)
    expect(
      suggestCategoryTargets(pairs, [
        { id: "c1", type: "expense", name: "COMIDA" },
        { id: "c2", type: "expense", name: "Bonos" }
      ])
    ).toEqual({
      "expense:comida": { kind: "existing", categoryId: "c1" },
      "income:bonos": { kind: "new", name: "Bonos" }
    })
  })

  it("categoryKeyFor", () => {
    expect(categoryKeyFor({ kind: "skip" }, "expense")).toBeNull()
    expect(
      categoryKeyFor({ kind: "existing", categoryId: "c1" }, "expense")
    ).toBe("existing:c1")
    expect(categoryKeyFor({ kind: "new", name: "Viajes" }, "expense")).toBe(
      "new:expense:viajes"
    )
  })
})

describe("cuentas", () => {
  it("accountValues y suggestAccountTargets", () => {
    const values = accountValues([
      { value: { accountLabel: "Nequi" } },
      { value: { accountLabel: "nequi" } },
      { value: { accountLabel: "" } },
      { value: { accountLabel: null } }
    ])
    expect(values).toEqual([
      { key: "nequi", label: "Nequi", count: 2 },
      { key: "", label: "", count: 1 }
    ])
    expect(
      suggestAccountTargets(
        [...values, { key: "banco", label: "Banco", count: 1 }],
        [{ id: "a1", name: "NEQUI" }]
      )
    ).toEqual({
      nequi: { kind: "existing", accountId: "a1" },
      "": { kind: "none" },
      banco: { kind: "new", name: "Banco" }
    })
  })
})

describe("vista previa y filas para la RPC", () => {
  const extracted = extractRows(
    [
      importSourceFixture(
        ["Fecha", "Descripción", "Categoría", "Monto", "Método"],
        [
          ["05/03/2026", "Mercado", "Comida", "-100", "Nequi"],
          ["06/03/2026", "Cine", "Ocio", "-50", "Banco"],
          ["07/03/2026", "Bus", "Transporte", "-10", ""],
          ["xx", "Mal", "Comida", "-1", ""]
        ]
      )
    ],
    importConfigFixture({
      mapping: { date: 0, description: 1, category: 2, amount: 3, account: 4 }
    }),
    TODAY
  ).rows
  const targets = {
    "expense:comida": { kind: "existing" as const, categoryId: "c1" },
    "expense:ocio": { kind: "new" as const, name: "Ocio" },
    "expense:transporte": { kind: "skip" as const }
  }
  const accountTargets = {
    nequi: { kind: "existing" as const, accountId: "a1" },
    banco: { kind: "new" as const, name: "Banco" },
    "": { kind: "none" as const }
  }
  const preview = buildPreviewRows(extracted, targets, accountTargets)

  it("buildPreviewRows aplica categorías y cuentas", () => {
    expect(preview.map((row) => [row.status, row.selected])).toEqual([
      ["ready", true],
      ["ready", true],
      ["skipped", false],
      ["error", false]
    ])
    expect(preview[0].value).toMatchObject({
      categoryKey: "existing:c1",
      accountKey: "existing:a1"
    })
    expect(preview[1].value).toMatchObject({
      categoryKey: "new:expense:ocio",
      accountKey: "new:banco"
    })
    expect(preview[2].reasons).toEqual([
      "Categoría «Transporte» marcada como No importar"
    ])
  })

  it("newCategories y newAccounts solo de filas marcadas", () => {
    const pairs = categoryPairs(extracted)
    expect(newCategories(preview as PreviewRow[], targets, pairs)).toEqual([
      { key: "new:expense:ocio", type: "expense", name: "Ocio" }
    ])
    expect(newAccounts(preview as PreviewRow[], accountTargets)).toEqual([
      { key: "new:banco", name: "Banco" }
    ])
  })

  it("computeStats suma las vacías en omitidas", () => {
    const rows: PreviewRow<unknown>[] = [
      ...preview,
      {
        sheet: "",
        sourceRow: 9,
        status: "duplicate",
        reasons: [],
        selected: false
      }
    ]
    expect(computeStats(rows, 2)).toEqual({
      read: 5,
      imported: 2,
      skipped: 3,
      duplicates: 1,
      errors: 1
    })
  })

  it("toTransactionImportRows separa ids existentes y claves nuevas", () => {
    expect(toTransactionImportRows(preview)).toEqual([
      {
        type: "expense",
        amount: 100,
        occurred_on: "2026-03-05",
        description: "Mercado",
        note: null,
        category_id: "c1",
        new_category_key: null,
        account_id: "a1",
        new_account_key: null
      },
      {
        type: "expense",
        amount: 50,
        occurred_on: "2026-03-06",
        description: "Cine",
        note: null,
        category_id: null,
        new_category_key: "new:expense:ocio",
        account_id: null,
        new_account_key: "new:banco"
      }
    ])
    expect(toImportRows(preview)).toHaveLength(2)
  })
})
