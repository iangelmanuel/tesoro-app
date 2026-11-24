import { describe, expect, it } from "vitest"
import { currentMonth } from "@/libs/dates"
import {
  buildFiltersQuery,
  escapeLikePattern,
  filtersDateRange,
  parseTransactionFilters
} from "./filters"

const ACCOUNT_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const CATEGORY_ID = "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d"

describe("parseTransactionFilters", () => {
  it("lee todos los filtros válidos", () => {
    expect(
      parseTransactionFilters({
        month: "2026-11",
        type: "expense",
        category: CATEGORY_ID,
        account: ACCOUNT_ID,
        q: "  café  ",
        page: "3"
      })
    ).toEqual({
      month: "2026-11",
      type: "expense",
      categoryId: CATEGORY_ID,
      accountId: ACCOUNT_ID,
      q: "café",
      page: 3
    })
  })

  it("acepta todos los meses, traspasos y sin cuenta", () => {
    const filters = parseTransactionFilters({
      month: "all",
      type: "transfer",
      account: "none"
    })
    expect(filters.month).toBe("all")
    expect(filters.type).toBe("transfer")
    expect(filters.accountId).toBe("none")
  })

  it("usa el primer valor de un parámetro repetido", () => {
    expect(
      parseTransactionFilters({ month: ["2026-01", "2026-02"] }).month
    ).toBe("2026-01")
  })

  it("trata los valores inválidos como ausentes", () => {
    expect(
      parseTransactionFilters({
        month: "2026-13",
        type: "otro",
        category: "no-uuid",
        account: "no-uuid",
        q: "   ",
        page: "0"
      })
    ).toEqual({
      month: currentMonth(),
      type: undefined,
      categoryId: undefined,
      accountId: undefined,
      q: undefined,
      page: 1
    })
  })

  it("sin parámetros da el mes actual y la página 1", () => {
    expect(parseTransactionFilters({})).toEqual({
      month: currentMonth(),
      type: undefined,
      categoryId: undefined,
      accountId: undefined,
      q: undefined,
      page: 1
    })
  })

  it("corta la búsqueda a 100 caracteres", () => {
    expect(parseTransactionFilters({ q: "a".repeat(150) }).q).toHaveLength(100)
  })
})

describe("filtersDateRange", () => {
  it("da el rango del mes", () => {
    expect(filtersDateRange({ month: "2026-02", page: 1 })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28"
    })
  })

  it("da null con todos los meses", () => {
    expect(filtersDateRange({ month: "all", page: 1 })).toBeNull()
  })
})

describe("buildFiltersQuery", () => {
  it("escribe siempre el mes y omite la página 1", () => {
    expect(buildFiltersQuery({ month: "2026-11", page: 1 })).toBe(
      "month=2026-11"
    )
  })

  it("escribe los filtros en orden fijo", () => {
    expect(
      buildFiltersQuery({
        month: "all",
        type: "income",
        categoryId: CATEGORY_ID,
        accountId: "none",
        q: "café con leche",
        page: 2
      })
    ).toBe(
      `month=all&type=income&category=${CATEGORY_ID}&account=none&q=caf%C3%A9+con+leche&page=2`
    )
  })

  it("aplica los cambios encima de los filtros", () => {
    expect(
      buildFiltersQuery(
        { month: "2026-11", type: "expense", page: 4 },
        { type: undefined, page: 1 }
      )
    ).toBe("month=2026-11")
  })
})

describe("escapeLikePattern", () => {
  it("escapa la barra invertida, % y _", () => {
    expect(escapeLikePattern(String.raw`50%_a\b`)).toBe(String.raw`50\%\_a\\b`)
  })

  it("deja igual el texto sin comodines", () => {
    expect(escapeLikePattern("mercado")).toBe("mercado")
  })
})
