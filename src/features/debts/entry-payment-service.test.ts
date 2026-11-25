import { describe, expect, it } from "vitest"
import { NO_DB, loadedDebt, loadedEntry } from "@/testing/debt-service-fixtures"
import {
  recordDebtPaymentRecord,
  validatePaymentChange
} from "./entry-payment-service"
import type { PaymentInput } from "./entry-schemas"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// deudas validan antes de escribir (las mismas que ve el MCP). Ninguno llega
// a Supabase.

describe("validatePaymentChange", () => {
  it("fija cada regla en su orden", () => {
    const pay = loadedEntry({})
    expect([
      validatePaymentChange(loadedEntry({}, { status: "paid" }), {
        amount: 1
      }),
      validatePaymentChange(loadedEntry({ kind: "adjustment" }), { amount: 1 }),
      validatePaymentChange(pay, { amount: 1, installments: 3 }),
      validatePaymentChange(loadedEntry({ kind: "advance" }), {
        amount: 1,
        is_extra_payment: true
      }),
      validatePaymentChange(loadedEntry({}, { kind: "receivable" }), {
        amount: 1,
        is_extra_payment: true
      }),
      validatePaymentChange(
        loadedEntry({ kind: "advance" }, { balance: 100_000 }),
        { amount: 50_000 }
      ),
      validatePaymentChange(pay, { amount: 1_200_000.01 }),
      validatePaymentChange(pay, { amount: 1_200_000 })
    ]).toMatchInlineSnapshot(`
      [
        "Reactiva la deuda para registrar movimientos",
        "Este movimiento se edita desde Actualizar saldo",
        "Solo las compras y avances de una tarjeta van a cuotas",
        "Un avance no es un abono extra",
        "Una cuenta por cobrar no tiene abonos extra",
        "El saldo de la deuda no puede quedar negativo",
        "El pago supera el saldo",
        null,
      ]
    `)
  })

  it("una mensual indefinida no tiene tope por saldo", () => {
    expect(
      validatePaymentChange(
        loadedEntry({}, { kind: "receivable", openEnded: true, balance: 0 }),
        { amount: 5_000_000 }
      )
    ).toBeNull()
  })
})

const PAYMENT: PaymentInput = {
  amount: 100_000,
  occurred_on: "2026-01-10",
  occurred_time: null,
  note: null,
  description: null,
  create_transaction: false,
  is_extra_payment: false,
  account_id: null,
  transfer_from: null,
  transfer_amount: null
}

describe("recordDebtPaymentRecord", () => {
  it("fija cada regla en su orden", async () => {
    const results = await Promise.all([
      recordDebtPaymentRecord(NO_DB, loadedDebt({ status: "paid" }), PAYMENT),
      recordDebtPaymentRecord(NO_DB, loadedDebt({ kind: "credit_card" }), {
        ...PAYMENT,
        create_transaction: true
      }),
      recordDebtPaymentRecord(NO_DB, loadedDebt({}), {
        ...PAYMENT,
        amount: 1_000_001
      }),
      recordDebtPaymentRecord(NO_DB, loadedDebt({ kind: "receivable" }), {
        ...PAYMENT,
        transfer_from: "account"
      }),
      recordDebtPaymentRecord(NO_DB, loadedDebt({ kind: "receivable" }), {
        ...PAYMENT,
        is_extra_payment: true
      })
    ])
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "error": "Reactiva la deuda para registrar movimientos",
          "ok": false,
        },
        {
          "error": "Un pago de tarjeta no crea un movimiento",
          "ok": false,
        },
        {
          "fieldErrors": {
            "amount": [
              "El pago supera el saldo",
            ],
          },
          "ok": false,
        },
        {
          "fieldErrors": {
            "transfer_from": [
              "Un abono no admite traspaso",
            ],
          },
          "ok": false,
        },
        {
          "error": "Una cuenta por cobrar no tiene abonos extra",
          "ok": false,
        },
      ]
    `)
  })
})
