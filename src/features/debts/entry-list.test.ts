import { describe, expect, it } from "vitest"
import { debtEntryFixture } from "@/testing/fixtures"
import {
  entryAccountText,
  entryLabel,
  groupByMonth,
  isFeminineEntry,
  lowersBalance
} from "./entry-list"

describe("groupByMonth", () => {
  it("agrupa por mes conservando el orden", () => {
    const entries = [
      debtEntryFixture({ id: "a", occurred_on: "2026-06-20" }),
      debtEntryFixture({ id: "b", occurred_on: "2026-05-31" }),
      debtEntryFixture({ id: "c", occurred_on: "2026-06-02" })
    ]
    expect(
      groupByMonth(entries).map(([month, group]) => [
        month,
        group.map((entry) => entry.id)
      ])
    ).toEqual([
      ["2026-06", ["a", "c"]],
      ["2026-05", ["b"]]
    ])
    expect(groupByMonth([])).toEqual([])
  })
})

describe("textos de la fila", () => {
  it("tipo del movimiento según la deuda", () => {
    const card = { kind: "credit_card" as const }
    expect([
      entryLabel(card, debtEntryFixture({ kind: "fee" })),
      entryLabel(card, debtEntryFixture({ kind: "advance" })),
      entryLabel(
        card,
        debtEntryFixture({ kind: "advance", payment_account_id: "bank" })
      ),
      entryLabel(card, debtEntryFixture({ kind: "payment" })),
      entryLabel(
        card,
        debtEntryFixture({ kind: "payment", is_extra_payment: true })
      ),
      entryLabel({ kind: "receivable" }, debtEntryFixture({ kind: "payment" })),
      entryLabel(card, debtEntryFixture({ kind: "adjustment" }))
    ]).toMatchInlineSnapshot(`
      [
        "Cuota de manejo",
        "Compra",
        "Avance",
        "Pago",
        "Abono",
        "Abono",
        "Ajuste",
      ]
    `)
  })

  it("cuenta de la fila según el tipo", () => {
    const card = { kind: "credit_card" as const }
    const withAccount = { payment_account_id: "bank", account_name: "Banco" }
    expect([
      entryAccountText(
        card,
        debtEntryFixture({ kind: "payment", ...withAccount })
      ),
      entryAccountText(
        { kind: "receivable" },
        debtEntryFixture({ kind: "payment", ...withAccount })
      ),
      entryAccountText(
        card,
        debtEntryFixture({ kind: "advance", ...withAccount })
      ),
      entryAccountText(card, debtEntryFixture({ kind: "advance" })),
      entryAccountText(card, debtEntryFixture({ kind: "payment" })),
      entryAccountText(card, debtEntryFixture({ kind: "fee", ...withAccount }))
    ]).toEqual([
      "Desde Banco",
      "A Banco",
      "A Banco",
      null,
      "Fuera de cuentas",
      null
    ])
  })

  it("dirección del saldo y género del tipo", () => {
    expect([
      lowersBalance(debtEntryFixture({ kind: "payment" })),
      lowersBalance(debtEntryFixture({ kind: "adjustment", amount: -5 })),
      lowersBalance(debtEntryFixture({ kind: "adjustment", amount: 5 })),
      lowersBalance(debtEntryFixture({ kind: "advance", amount: 5 }))
    ]).toEqual([true, true, false, false])
    expect([
      isFeminineEntry(debtEntryFixture({ kind: "fee" })),
      isFeminineEntry(debtEntryFixture({ kind: "advance" })),
      isFeminineEntry(
        debtEntryFixture({ kind: "advance", payment_account_id: "bank" })
      ),
      isFeminineEntry(debtEntryFixture({ kind: "payment" }))
    ]).toEqual([true, true, false, false])
  })
})
