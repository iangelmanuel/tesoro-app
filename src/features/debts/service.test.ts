import { describe, expect, it } from "vitest"
import { NO_DB } from "@/testing/debt-service-fixtures"
import { markDebtPaidRecord } from "./service"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

describe("markDebtPaidRecord", () => {
  it("pide saldo 0 y no marca pagada una mensual indefinida", async () => {
    const workspace = { id: "workspace" }
    expect([
      await markDebtPaidRecord(NO_DB, workspace, {
        id: "debt",
        balance: 10,
        openEnded: false
      }),
      await markDebtPaidRecord(NO_DB, workspace, {
        id: "debt",
        balance: 0,
        openEnded: true
      })
    ]).toMatchInlineSnapshot(`
      [
        {
          "error": "La deuda aún tiene saldo",
          "ok": false,
        },
        {
          "error": "Un cobro mensual sin número de cuotas se archiva",
          "ok": false,
        },
      ]
    `)
  })
})
