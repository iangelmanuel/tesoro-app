import { describe, expect, it } from "vitest"
import { NO_DB, loadedDebt } from "@/testing/debt-service-fixtures"
import { recordCardAdvanceRecord } from "./entry-advance-service"
import type { AdvanceInput } from "./entry-schemas"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

const ADVANCE: AdvanceInput = {
  amount: 300_000,
  occurred_on: "2026-01-10",
  occurred_time: null,
  note: null,
  account_id: null,
  installments: null
}

describe("recordCardAdvanceRecord", () => {
  it("fija cada regla en su orden", async () => {
    const card = loadedDebt({ kind: "credit_card" })
    expect([
      await recordCardAdvanceRecord(
        NO_DB,
        { ...card, status: "archived" },
        ADVANCE,
        false
      ),
      await recordCardAdvanceRecord(NO_DB, loadedDebt({}), ADVANCE, false),
      await recordCardAdvanceRecord(NO_DB, card, ADVANCE, true)
    ]).toMatchInlineSnapshot(`
      [
        {
          "error": "Reactiva la deuda para registrar movimientos",
          "ok": false,
        },
        {
          "error": "Solo una tarjeta admite avances",
          "ok": false,
        },
        {
          "fieldErrors": {
            "account_id": [
              "Elige la cuenta a la que entró el avance",
            ],
          },
          "ok": false,
        },
      ]
    `)
  })
})
