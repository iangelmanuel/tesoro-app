import { describe, expect, it } from "vitest"
import type { DebtEntry } from "@/features/debts/queries"
import { debtEntryFixture } from "@/testing/fixtures"
import {
  ENTRY_TYPES,
  balanceEffect,
  entryKindOf,
  entryTransactionType,
  entryTypeInfo,
  entryTypeOf,
  entryTypesFor,
  linkableTransactionType,
  usesPaymentAccount
} from "./entry-types"

// Tests de caracterización (SPEC 55b): fijan los tipos de movimiento de una
// deuda antes de partir la feature

describe("entryTypeInfo", () => {
  it("fija nombre y ayuda de cada tipo por clase de deuda", () => {
    expect(
      (["credit_card", "loan", "receivable"] as const).map((kind) =>
        ENTRY_TYPES.map((type) => `${type}: ${entryTypeInfo(type, kind).label}`)
      )
    ).toMatchInlineSnapshot(`
      [
        [
          "payment: Pago",
          "extra: Abono",
          "purchase: Compra",
          "advance: Avance",
          "fee: Cuota de manejo",
          "adjustment: Ajuste",
        ],
        [
          "payment: Pago",
          "extra: Abono",
          "purchase: Compra",
          "advance: Avance",
          "fee: Cuota de manejo",
          "adjustment: Ajuste",
        ],
        [
          "payment: Cobro",
          "extra: Abono",
          "purchase: Compra",
          "advance: Avance",
          "fee: Cuota de manejo",
          "adjustment: Ajuste",
        ],
      ]
    `)
    expect(entryTypeInfo("payment", "loan").hint).toBe(
      "La cuota del mes. Baja el saldo."
    )
    expect(entryTypeInfo("payment", "receivable").hint).toBe(
      "Lo que te pagaron. Baja lo que te deben."
    )
  })
})

describe("entryTypesFor", () => {
  it("tarjeta, préstamo y cuenta por cobrar", () => {
    expect(entryTypesFor({ kind: "credit_card", schedule: null })).toEqual([
      "payment",
      "extra",
      "purchase",
      "advance",
      "fee",
      "adjustment"
    ])
    expect(entryTypesFor({ kind: "loan", schedule: null })).toEqual([
      "payment",
      "extra",
      "adjustment"
    ])
    expect(entryTypesFor({ kind: "receivable", schedule: "once" })).toEqual([
      "payment",
      "adjustment"
    ])
  })

  it("la mensual no lleva ajustes nuevos, pero conserva el que ya es ajuste", () => {
    const monthly = { kind: "receivable", schedule: "monthly" } as const
    expect(entryTypesFor(monthly)).toEqual(["payment"])
    expect(entryTypesFor(monthly, "adjustment")).toEqual([
      "payment",
      "adjustment"
    ])
  })
})

describe("entryTypeOf, entryKindOf y balanceEffect", () => {
  it("traduce entre el kind guardado y el tipo de la pantalla", () => {
    const of = (fields: Partial<DebtEntry>) =>
      entryTypeOf(debtEntryFixture(fields))
    expect(of({})).toBe("payment")
    expect(of({ is_extra_payment: true })).toBe("extra")
    expect(of({ kind: "advance" })).toBe("purchase")
    expect(of({ kind: "advance", payment_account_id: "bank" })).toBe("advance")
    expect(of({ kind: "fee" })).toBe("fee")
    expect(of({ kind: "adjustment" })).toBe("adjustment")
    expect(ENTRY_TYPES.map(entryKindOf)).toEqual([
      "payment",
      "payment",
      "advance",
      "advance",
      "fee",
      "adjustment"
    ])
  })

  it("el pago baja el saldo y lo demás lo sube según su signo", () => {
    expect(balanceEffect("payment", 100)).toBe(-100)
    expect(balanceEffect("advance", 100)).toBe(100)
    expect(balanceEffect("adjustment", -50)).toBe(-50)
  })
})

describe("movimiento enlazado", () => {
  const TYPES = [
    "payment",
    "extra",
    "purchase",
    "advance",
    "fee",
    "adjustment"
  ] as const

  it("entrada o salida según el tipo y la deuda", () => {
    expect(
      (["credit_card", "loan", "receivable"] as const).map((kind) =>
        TYPES.map((type) => [
          entryTransactionType(type, kind),
          linkableTransactionType(type, kind)
        ])
      )
    ).toMatchInlineSnapshot(`
      [
        [
          [
            "expense",
            "expense",
          ],
          [
            "expense",
            "expense",
          ],
          [
            "expense",
            null,
          ],
          [
            "income",
            "income",
          ],
          [
            "expense",
            null,
          ],
          [
            "expense",
            null,
          ],
        ],
        [
          [
            "expense",
            "expense",
          ],
          [
            "expense",
            "expense",
          ],
          [
            "expense",
            null,
          ],
          [
            "income",
            "income",
          ],
          [
            "expense",
            null,
          ],
          [
            "expense",
            null,
          ],
        ],
        [
          [
            "income",
            "income",
          ],
          [
            "income",
            "income",
          ],
          [
            "income",
            null,
          ],
          [
            "income",
            "income",
          ],
          [
            "income",
            null,
          ],
          [
            "income",
            null,
          ],
        ],
      ]
    `)
  })

  it("qué tipos usan una cuenta", () => {
    expect(
      TYPES.map((type) => [
        usesPaymentAccount(type, true, false),
        usesPaymentAccount(type, false, false),
        usesPaymentAccount(type, false, true)
      ])
    ).toMatchInlineSnapshot(`
      [
        [
          true,
          false,
          true,
        ],
        [
          true,
          false,
          true,
        ],
        [
          false,
          false,
          false,
        ],
        [
          true,
          true,
          true,
        ],
        [
          false,
          false,
          false,
        ],
        [
          false,
          false,
          false,
        ],
      ]
    `)
  })
})
