import { describe, expect, it } from "vitest"
import type { Category } from "@/features/categories/queries"
import { availableBudgetCategories, isBudgeted } from "./budget-rows"
import type { BudgetProgress } from "./queries"

const progress = (
  categoryId: string,
  budgetId: string | null,
  budgetAmount: number | null
): BudgetProgress => ({
  categoryId,
  name: categoryId,
  icon: "tag",
  color: "slate",
  archived: false,
  budgetId,
  budgetAmount,
  spent: 0,
  committed: 0
})

const category = (
  id: string,
  type: Category["type"],
  archivedAt: string | null = null
) => ({ id, type, archived_at: archivedAt }) as Category

describe("isBudgeted", () => {
  it("exige presupuesto y monto", () => {
    expect(isBudgeted(progress("a", "b1", 100))).toBe(true)
    expect(isBudgeted(progress("a", null, null))).toBe(false)
    expect(isBudgeted(progress("a", "b1", null))).toBe(false)
  })
})

describe("availableBudgetCategories", () => {
  it("ofrece categorías de gasto activas sin presupuesto en el mes", () => {
    const categories = [
      category("food", "expense"),
      category("rent", "expense"),
      category("old", "expense", "2026-01-01T00:00:00Z"),
      category("salary", "income")
    ]
    expect(
      availableBudgetCategories(categories, [{ categoryId: "rent" }]).map(
        (item) => item.id
      )
    ).toEqual(["food"])
  })
})
