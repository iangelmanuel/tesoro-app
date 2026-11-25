import { describe, expect, it } from "vitest"
import { NO_DB, loadedEntry } from "@/testing/debt-service-fixtures"
import type { DebtEntryEditInput } from "./entry-schemas"
import { deleteEntryRecord, updateDebtEntryRecord } from "./entry-service"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

describe("validaciones antes de escribir", () => {
  it("updateDebtEntryRecord: deuda, tipo y cuenta", async () => {
    const input: DebtEntryEditInput = {
      type: "payment",
      amount: 100,
      direction: null,
      occurred_on: "2026-01-10",
      occurred_time: null,
      note: null,
      account_id: null,
      create_transaction: true,
      description: null,
      category_id: null,
      installments: null,
      link_transaction_id: null
    }
    const results = await Promise.all([
      updateDebtEntryRecord(
        NO_DB,
        loadedEntry({}, { status: "archived" }),
        input
      ),
      updateDebtEntryRecord(NO_DB, loadedEntry({}), {
        ...input,
        type: "purchase"
      }),
      updateDebtEntryRecord(
        NO_DB,
        loadedEntry({}, { kind: "receivable", schedule: "monthly" }),
        { ...input, type: "adjustment", direction: "up" }
      ),
      updateDebtEntryRecord(NO_DB, loadedEntry({}), input)
    ])
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "error": "Reactiva la deuda para registrar movimientos",
          "ok": false,
        },
        {
          "fieldErrors": {
            "type": [
              "Este tipo de movimiento no aplica a esta deuda",
            ],
          },
          "ok": false,
        },
        {
          "fieldErrors": {
            "type": [
              "Este tipo de movimiento no aplica a esta deuda",
            ],
          },
          "ok": false,
        },
        {
          "fieldErrors": {
            "account_id": [
              "Elige la cuenta del pago",
            ],
          },
          "ok": false,
        },
      ]
    `)
  })

  it("deleteEntryRecord no deja el saldo negativo", async () => {
    expect([
      await deleteEntryRecord(NO_DB, loadedEntry({}, { status: "paid" })),
      await deleteEntryRecord(
        NO_DB,
        loadedEntry({ kind: "fee", amount: 50_000 }, { balance: 40_000 })
      )
    ]).toMatchInlineSnapshot(`
      [
        {
          "error": "Reactiva la deuda para registrar movimientos",
          "ok": false,
        },
        {
          "error": "El saldo de la deuda no puede quedar negativo",
          "ok": false,
        },
      ]
    `)
  })
})
