import { describe, expect, it } from "vitest"
import type { AppSupabase } from "@/libs/supabase/types"
import { debtEntryFixture } from "@/testing/fixtures"
import {
  recordDebtPaymentRecord,
  validatePaymentChange
} from "./entry-payment-service"
import type { DebtEntryEditInput, PaymentInput } from "./entry-schemas"
import {
  type LoadedDebt,
  type LoadedEntry,
  deleteEntryRecord,
  entryRecord,
  updateDebtEntryRecord
} from "./entry-service"
import {
  recordReceivableCollection,
  validateReceivableCollection
} from "./receivable-service"

// Tests de caracterización (SPEC 55b): fijan las reglas que los servicios de
// movimientos de deuda validan antes de escribir (las mismas que ve el MCP)
// antes de partir entry-service.ts. Ninguno llega a Supabase.

/** Cliente que falla si se usa: los casos probados no deben consultar */
const NO_DB = new Proxy(
  {},
  {
    get() {
      throw new Error("No debe consultar Supabase")
    }
  }
) as AppSupabase

function loadedDebt(fields: Partial<LoadedDebt>): LoadedDebt {
  return {
    id: "debt",
    workspace_id: "workspace",
    kind: "loan",
    status: "active",
    name: "Deuda",
    opening_balance: 1_000_000,
    installment: null,
    schedule: null,
    starts_on: null,
    term_months: null,
    entries: [],
    balance: 1_000_000,
    openEnded: false,
    ...fields
  }
}

function loadedEntry(
  fields: Partial<LoadedEntry>,
  debt: Partial<LoadedDebt> = {}
): LoadedEntry {
  const {
    account_name,
    payment_account_id,
    description,
    category_id,
    allocations,
    ...row
  } = debtEntryFixture({ amount: 200_000 })
  void account_name
  void payment_account_id
  void description
  void category_id
  void allocations
  return { ...row, debt: loadedDebt(debt), ...fields }
}

describe("entryRecord", () => {
  it("quita la deuda y deja la fila del abono", () => {
    const entry = loadedEntry({ id: "e1" })
    const record = entryRecord(entry)
    expect("debt" in record).toBe(false)
    expect(record.id).toBe("e1")
  })
})

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

describe("validaciones antes de escribir", () => {
  it("recordDebtPaymentRecord", async () => {
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
