import { describe, expect, it } from "vitest"
import { NO_DB, loadedDebt } from "@/testing/debt-service-fixtures"
import {
  adjustBalanceRecord,
  recordDebtChargeRecord
} from "./entry-adjustment-service"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

const DAY = { occurred_on: "2026-01-10", occurred_time: null, note: null }

describe("adjustBalanceRecord", () => {
  it("pide deuda activa y un saldo distinto al actual", async () => {
    expect([
      await adjustBalanceRecord(NO_DB, loadedDebt({ status: "paid" }), {
        ...DAY,
        balance: 0
      }),
      await adjustBalanceRecord(NO_DB, loadedDebt({ balance: 1_000_000 }), {
        ...DAY,
        balance: 1_000_000.004
      })
    ]).toMatchInlineSnapshot(`
      [
        {
          "error": "Reactiva la deuda para registrar movimientos",
          "ok": false,
        },
        {
          "fieldErrors": {
            "balance": [
              "El saldo ya es ese",
            ],
          },
          "ok": false,
        },
      ]
    `)
  })
})

describe("recordDebtChargeRecord", () => {
  it("pide deuda activa y un tipo que la deuda admite", async () => {
    expect([
      await recordDebtChargeRecord(NO_DB, loadedDebt({ status: "archived" }), {
        ...DAY,
        type: "fee",
        amount: 15_000,
        direction: null
      }),
      await recordDebtChargeRecord(NO_DB, loadedDebt({}), {
        ...DAY,
        type: "fee",
        amount: 15_000,
        direction: null
      }),
      await recordDebtChargeRecord(
        NO_DB,
        loadedDebt({ kind: "receivable", schedule: "monthly" }),
        { ...DAY, type: "adjustment", amount: 10, direction: "up" }
      )
    ]).toMatchInlineSnapshot(`
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
      ]
    `)
  })
})
