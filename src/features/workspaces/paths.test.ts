import { describe, expect, it } from "vitest"
import {
  workspaceBasePath,
  workspaceCashFlowPath,
  workspaceRecommendationsPath,
  workspaceReportsPath,
  workspaceTransactionsPath
} from "./paths"

const PERSONAL = { id: "p1", type: "personal" as const }
const BUSINESS = { id: "b1", type: "business" as const }

describe("workspaceBasePath", () => {
  it("Personal no lleva id", () => {
    expect(workspaceBasePath(PERSONAL)).toBe("/dashboard/personal")
  })

  it("Empresa lleva su id", () => {
    expect(workspaceBasePath(BUSINESS)).toBe("/dashboard/business/b1")
  })
})

describe("rutas del espacio", () => {
  it("cuelgan de la ruta base", () => {
    expect(workspaceTransactionsPath(PERSONAL)).toBe(
      "/dashboard/personal/transactions"
    )
    expect(workspaceReportsPath(BUSINESS)).toBe(
      "/dashboard/business/b1/reports"
    )
    expect(workspaceCashFlowPath(BUSINESS)).toBe(
      "/dashboard/business/b1/cash-flow"
    )
    expect(workspaceRecommendationsPath(PERSONAL)).toBe(
      "/dashboard/personal/recommendations"
    )
  })
})
