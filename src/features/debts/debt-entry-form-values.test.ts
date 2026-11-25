import { describe, expect, it } from "vitest"
import { debtEntryFixture } from "@/testing/fixtures"
import {
  accountEffect,
  adoptLinkable,
  entryCategoryPlaceholder,
  entryDescriptionPlaceholder,
  entryFormFlags,
  initialEntryForm,
  missingEntryFields,
  projectedBalance
} from "./debt-entry-form-values"
import type { EntryType } from "./entry-types"
import type { DebtEntry, LinkableTransaction } from "./queries"

const TYPES: EntryType[] = [
  "payment",
  "extra",
  "purchase",
  "advance",
  "fee",
  "adjustment"
]

describe("initialEntryForm", () => {
  it("toma los valores del movimiento guardado", () => {
    expect(
      initialEntryForm(
        debtEntryFixture({
          kind: "adjustment",
          amount: -12_500.5,
          occurred_on: "2026-05-10",
          occurred_time: "08:30:00",
          note: "Intereses"
        })
      )
    ).toMatchInlineSnapshot(`
      {
        "accountId": "",
        "amountText": "12.500,5",
        "createTransaction": true,
        "description": "",
        "direction": "down",
        "note": "Intereses",
        "occurredOn": "2026-05-10",
        "time": "08:30",
        "type": "adjustment",
      }
    `)
  })

  it("un pago sin movimiento arranca sin registrarlo", () => {
    expect(initialEntryForm(debtEntryFixture({})).createTransaction).toBe(false)
    expect(
      initialEntryForm(debtEntryFixture({ transaction_id: "tx" }))
        .createTransaction
    ).toBe(true)
  })
})

describe("entryFormFlags", () => {
  const flags = (
    type: EntryType,
    debtKind: "credit_card" | "loan" | "receivable",
    createTransaction = true,
    entry: Pick<DebtEntry, "kind" | "transaction_id"> = {
      kind: "payment",
      transaction_id: null
    }
  ) => entryFormFlags({ type, debtKind, createTransaction, entry })

  it("fija qué pide cada tipo en tarjeta, préstamo y cuenta por cobrar", () => {
    expect(
      (["credit_card", "loan", "receivable"] as const).map((kind) =>
        TYPES.map((type) => {
          const f = flags(type, kind)
          return [
            type,
            f.showAccount && "cuenta",
            f.accountRequired && "obligatoria",
            f.accountRequired && "movimiento",
            f.showLink && "enlace",
            f.transactionType
          ]
            .filter(Boolean)
            .join(" ")
        })
      )
    ).toMatchInlineSnapshot(`
      [
        [
          "payment cuenta expense",
          "extra cuenta expense",
          "purchase expense",
          "advance cuenta obligatoria movimiento enlace income",
          "fee expense",
          "adjustment expense",
        ],
        [
          "payment cuenta obligatoria movimiento enlace expense",
          "extra cuenta obligatoria movimiento enlace expense",
          "purchase expense",
          "advance cuenta obligatoria movimiento enlace income",
          "fee expense",
          "adjustment expense",
        ],
        [
          "payment cuenta obligatoria movimiento enlace income",
          "extra cuenta obligatoria movimiento enlace income",
          "purchase income",
          "advance cuenta obligatoria movimiento enlace income",
          "fee income",
          "adjustment income",
        ],
      ]
    `)
  })

  it("sin registrar el movimiento, el pago de préstamo no pide cuenta", () => {
    expect(flags("payment", "loan", false)).toMatchObject({
      createsTransaction: false,
      showAccount: false,
      accountRequired: false
    })
  })

  it("el pago de tarjeta que ya era pago no ofrece enlazar", () => {
    expect(flags("payment", "credit_card").showLink).toBe(false)
    expect(
      flags("payment", "credit_card", true, {
        kind: "advance",
        transaction_id: "tx"
      }).showLink
    ).toBe(true)
  })
})

describe("projectedBalance y missingEntryFields", () => {
  const entry = { kind: "payment" as const, amount: 100_000 }

  it("quita el movimiento guardado y suma el nuevo", () => {
    expect([
      projectedBalance({
        debtBalance: 900_000,
        entry,
        kind: "payment",
        type: "payment",
        amount: 150_000,
        direction: "up"
      }),
      projectedBalance({
        debtBalance: 900_000,
        entry,
        kind: "adjustment",
        type: "adjustment",
        amount: 50_000.1,
        direction: "down"
      }),
      projectedBalance({
        debtBalance: 900_000,
        entry,
        kind: "payment",
        type: "payment",
        amount: 0,
        direction: "up"
      })
    ]).toEqual([850_000, 949_999.9, null])
  })

  it("pide el monto y la cuenta si faltan", () => {
    expect(
      missingEntryFields({
        validAmount: false,
        accountRequired: true,
        accountId: "",
        linkId: ""
      })
    ).toEqual(["el monto", "la cuenta"])
    expect(
      missingEntryFields({
        validAmount: true,
        accountRequired: true,
        accountId: "",
        linkId: "tx"
      })
    ).toEqual([])
  })
})

describe("adoptLinkable", () => {
  const candidate = {
    id: "tx",
    account_id: "bank",
    occurred_on: "2026-05-02",
    occurred_time: "10:15:00",
    description: "Pago tarjeta",
    note: null
  } as LinkableTransaction

  it("en un pago de tarjeta la descripción pasa a la nota", () => {
    expect(adoptLinkable(candidate, true)).toEqual({
      accountId: "bank",
      occurredOn: "2026-05-02",
      time: "10:15",
      note: "Pago tarjeta"
    })
  })

  it("en los demás toma la descripción y la nota solo si tiene", () => {
    expect(adoptLinkable(candidate, false)).toEqual({
      accountId: "bank",
      occurredOn: "2026-05-02",
      time: "10:15",
      description: "Pago tarjeta"
    })
    expect(adoptLinkable({ ...candidate, note: "Banco" }, false).note).toBe(
      "Banco"
    )
  })
})

describe("textos", () => {
  it("placeholders de descripción y categoría", () => {
    expect([
      entryDescriptionPlaceholder("advance", false, "Visa"),
      entryDescriptionPlaceholder("extra", false, "Préstamo"),
      entryDescriptionPlaceholder("payment", true, "Ana"),
      entryDescriptionPlaceholder("payment", false, "Préstamo"),
      entryCategoryPlaceholder("advance", false),
      entryCategoryPlaceholder("payment", true),
      entryCategoryPlaceholder("payment", false)
    ]).toMatchInlineSnapshot(`
      [
        "Avance Visa",
        "Abono Préstamo",
        "Abono Ana",
        "Pago Préstamo",
        "Avance de tarjeta",
        "Cobros",
        "Deudas",
      ]
    `)
  })

  it("efecto en las cuentas", () => {
    const base = {
      isCard: false,
      isReceivable: false,
      createsTransaction: true,
      accountName: "Banco",
      linking: false
    }
    expect([
      ...TYPES.map((type) => accountEffect({ ...base, type })),
      accountEffect({ ...base, type: "payment", isCard: true }),
      accountEffect({ ...base, type: "extra", isCard: true, linking: true }),
      accountEffect({
        ...base,
        type: "payment",
        isCard: true,
        accountName: null
      }),
      accountEffect({ ...base, type: "payment", createsTransaction: false }),
      accountEffect({
        ...base,
        type: "payment",
        isReceivable: true,
        linking: true
      }),
      accountEffect({ ...base, type: "payment", accountName: null }),
      accountEffect({ ...base, type: "advance", linking: true }),
      accountEffect({ ...base, type: "advance", accountName: null })
    ]).toMatchInlineSnapshot(`
      [
        "Sale de Banco como salida.",
        "Sale de Banco como salida. No cubre el pago del mes.",
        "Una compra no toca tus cuentas: solo sube el saldo de la tarjeta.",
        "Entra a Banco como entrada (Avance de tarjeta).",
        "La cuota de manejo no toca tus cuentas: la pagas con la tarjeta.",
        "Un ajuste no toca tus cuentas.",
        "Sale de Banco hacia la tarjeta. No cuenta como salida.",
        "La salida elegida se elimina: el pago a la tarjeta ya descuenta de la cuenta. No cubre el pago del mes.",
        "No toca tus cuentas: solo baja el saldo.",
        "No queda como salida en Movimientos.",
        "Se enlaza a la entrada elegida: no se crea otra.",
        "Elige la cuenta.",
        "Se enlaza a la entrada elegida: no se crea otra.",
        "Elige la cuenta a la que entró el dinero.",
      ]
    `)
  })
})
