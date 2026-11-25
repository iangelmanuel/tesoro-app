import { describe, expect, it } from "vitest"
import { NO_DB, loadedDebt } from "@/testing/debt-service-fixtures"
import {
  recordReceivableCollection,
  validateReceivableCollection
} from "./receivable-service"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

describe("validateReceivableCollection", () => {
  const once = loadedDebt({
    kind: "receivable",
    schedule: "once",
    balance: 300_000
  })

  it("fija cada regla en su orden", () => {
    expect([
      validateReceivableCollection(loadedDebt({}), { mode: "partial" }),
      validateReceivableCollection(
        { ...once, status: "archived" },
        { mode: "partial" }
      ),
      validateReceivableCollection(once, { mode: "single" }),
      validateReceivableCollection({ ...once, balance: 0 }, { mode: "full" }),
      validateReceivableCollection(once, { mode: "partial", amount: 300_001 }),
      validateReceivableCollection(once, { mode: "partial", amount: 300_000 })
    ]).toMatchInlineSnapshot(`
      [
        {
          "error": "No se encontró la cuenta por cobrar",
        },
        {
          "error": "Reactiva la deuda para registrar movimientos",
        },
        {
          "error": "Elige cómo se cobra",
        },
        {
          "error": "El cobro supera el saldo pendiente",
        },
        {
          "fieldErrors": {
            "amount": [
              "El cobro supera el saldo pendiente",
            ],
          },
        },
        null,
      ]
    `)
  })

  it("la mensual indefinida acepta cualquier monto", () => {
    expect(
      validateReceivableCollection(
        loadedDebt({
          kind: "receivable",
          schedule: "monthly",
          openEnded: true,
          balance: 0
        }),
        { mode: "allocate", amount: 9_000_000 }
      )
    ).toBeNull()
  })
})

describe("recordReceivableCollection", () => {
  it("recordReceivableCollection usa el saldo en el pago completo", async () => {
    expect(
      await recordReceivableCollection(
        NO_DB,
        loadedDebt({ kind: "receivable", schedule: "once", balance: 0 }),
        {
          mode: "full",
          occurred_on: "2026-01-10",
          note: null,
          description: null,
          create_transaction: false,
          account_id: null
        }
      )
    ).toMatchInlineSnapshot(`
      {
        "error": "El cobro supera el saldo pendiente",
        "ok": false,
      }
    `)
  })
})
