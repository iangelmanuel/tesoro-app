import { describe, expect, it } from "vitest"
import { accountFilterOptions, categoryFilterOptions } from "./filter-options"

const ARCHIVED = "2026-01-01T00:00:00Z"

const CATEGORIES = [
  { id: "c1", name: "Viejo", type: "expense" as const, archived_at: ARCHIVED },
  { id: "c2", name: "Mercado", type: "expense" as const, archived_at: null },
  { id: "c3", name: "Salario", type: "income" as const, archived_at: null }
]

describe("categoryFilterOptions", () => {
  it("lista todas con las archivadas al final", () => {
    expect(categoryFilterOptions(CATEGORIES, undefined)).toEqual([
      { id: "all", label: "Todas" },
      { id: "c2", label: "Mercado" },
      { id: "c3", label: "Salario" },
      { id: "c1", label: "Viejo (archivada)" }
    ])
  })

  it("con tipo elegido solo ofrece sus categorías", () => {
    expect(
      categoryFilterOptions(CATEGORIES, "income").map((option) => option.id)
    ).toEqual(["all", "c3"])
  })

  it("con traspasos no ofrece categorías", () => {
    expect(categoryFilterOptions(CATEGORIES, "transfer")).toEqual([
      { id: "all", label: "Todas" }
    ])
  })
})

describe("accountFilterOptions", () => {
  it("agrega Sin cuenta y deja las archivadas al final", () => {
    expect(
      accountFilterOptions([
        { id: "a1", name: "Caja", archived_at: ARCHIVED },
        { id: "a2", name: "Banco", archived_at: null }
      ])
    ).toEqual([
      { id: "all", label: "Todas" },
      { id: "none", label: "Sin cuenta" },
      { id: "a2", label: "Banco" },
      { id: "a1", label: "Caja (archivada)" }
    ])
  })
})
