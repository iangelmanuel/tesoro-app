import { describe, expect, it } from "vitest"
import { debtEntryFixture } from "@/testing/fixtures"
import { debtEntryEditValues, paymentAccount } from "./debt-entry-values"

const ACCOUNTS = [
  { id: "a1", name: "Banco" },
  { id: "a2", name: "Nequi" }
]

describe("paymentAccount", () => {
  const base = { id: undefined, name: undefined, label: "la cuenta" }

  it("sin datos usa la habitual si sigue activa", () => {
    expect(paymentAccount(ACCOUNTS, { ...base, habitual: "a2" })).toEqual({
      value: "a2"
    })
  })

  it("la habitual archivada no cuenta: se pregunta", () => {
    expect(
      paymentAccount(ACCOUNTS, { ...base, habitual: "vieja" })
    ).toMatchObject({ missing: { field: "account_id" } })
  })

  it("id, null o nombre ganan sobre la habitual", () => {
    expect(
      paymentAccount(ACCOUNTS, { ...base, id: null, habitual: "a2" })
    ).toEqual({ value: null })
    expect(
      paymentAccount(ACCOUNTS, { ...base, name: "banco", habitual: "a2" })
    ).toEqual({ value: "a1" })
  })
})

describe("debtEntryEditValues", () => {
  it("sin cambios, prellena con lo guardado", () => {
    const current = debtEntryFixture({
      kind: "adjustment",
      amount: -50,
      occurred_on: "2026-10-05",
      occurred_time: "14:30:00",
      note: "nota",
      description: "Ajuste",
      category_id: "c1",
      installments: 3
    })
    expect(debtEntryEditValues(current, {}, "a1")).toEqual({
      type: "adjustment",
      amount: 50,
      direction: "down",
      occurred_on: "2026-10-05",
      occurred_time: "14:30",
      note: "nota",
      account_id: "a1",
      create_transaction: true,
      description: "Ajuste",
      category_id: "c1",
      installments: 3,
      link_transaction_id: ""
    })
  })

  it("un pago sin movimiento enlazado no crea transacción", () => {
    const current = debtEntryFixture({ kind: "payment", amount: 100 })
    expect(debtEntryEditValues(current, {}, null)).toMatchObject({
      type: "payment",
      direction: "",
      occurred_time: "",
      note: "",
      account_id: "",
      create_transaction: false,
      installments: ""
    })
  })

  it("los cambios van encima; null borra hora, nota y cuotas", () => {
    const current = debtEntryFixture({
      kind: "advance",
      amount: 100,
      occurred_time: "08:00:00",
      note: "x",
      installments: 6,
      payment_account_id: "a1"
    })
    expect(
      debtEntryEditValues(
        current,
        {
          amount: 80,
          time: null,
          note: null,
          installments: null,
          link_transaction_id: "t1"
        },
        "a1"
      )
    ).toMatchObject({
      type: "advance",
      amount: 80,
      occurred_time: "",
      note: "",
      installments: "",
      link_transaction_id: "t1"
    })
  })
})
