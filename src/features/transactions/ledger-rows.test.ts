import { describe, expect, it } from "vitest"
import {
  type AccountMovementEntry,
  accountMovementDeletedText,
  describeAccountMovement,
  entryDate,
  entryId,
  isAccountMovement,
  linkedPaymentNoun,
  reorderRows,
  rowKey,
  rowReorders,
  rowTitle
} from "./ledger-rows"
import type { LedgerEntry } from "./types"

function transaction(id: string, day: string, description = id): LedgerEntry {
  return {
    kind: "expense",
    occurred_time: null,
    day_position: 0,
    debt_entry: null,
    transaction: {
      id,
      type: "expense",
      amount: 100,
      occurred_on: day,
      occurred_time: null,
      category_id: "c1",
      description,
      note: null,
      account_id: null,
      counterparty: null,
      invoice_ref: null,
      recurring_expense_id: null,
      recurring_income_id: null,
      recurring_income_allocations: []
    }
  }
}

function transfer(id: string, day: string): LedgerEntry {
  return {
    kind: "transfer",
    id,
    amount: 50,
    occurred_on: day,
    occurred_time: null,
    day_position: 0,
    note: null,
    from_account_id: "a1",
    to_account_id: "a2"
  }
}

function movement(
  fields: Partial<AccountMovementEntry> & Pick<AccountMovementEntry, "kind">
): AccountMovementEntry {
  return {
    id: "m1",
    amount: 100,
    occurred_on: "2026-11-20",
    occurred_time: null,
    day_position: 0,
    note: null,
    account_id: "a1",
    name: "Visa",
    parent_id: "d1",
    is_extra_payment: false,
    parent_active: true,
    ...fields
  } as AccountMovementEntry
}

describe("llaves de la fila", () => {
  it("usa el id del movimiento o de la fila", () => {
    const tx = transaction("t1", "2026-11-20")
    const tr = transfer("x1", "2026-11-19")
    expect(entryId(tx)).toBe("t1")
    expect(entryId(tr)).toBe("x1")
    expect(entryDate(tx)).toBe("2026-11-20")
    expect(entryDate(tr)).toBe("2026-11-19")
    expect(rowKey(tx)).toBe("expense:t1")
    expect(rowKey(tr)).toBe("transfer:x1")
  })

  it("reconoce pagos, avances y aportes", () => {
    expect(isAccountMovement(movement({ kind: "debt_payment" }))).toBe(true)
    expect(isAccountMovement(transfer("x1", "2026-11-20"))).toBe(false)
  })
})

describe("describeAccountMovement", () => {
  it("nombra pagos, abonos y avances de tarjeta", () => {
    expect(
      describeAccountMovement(movement({ kind: "debt_payment" }))
    ).toMatchObject({
      title: "Pago · Visa",
      type: "Pago de tarjeta",
      increases: false
    })
    expect(
      describeAccountMovement(
        movement({ kind: "debt_payment", is_extra_payment: true })
      )
    ).toMatchObject({ title: "Abono · Visa", type: "Abono a tarjeta" })
    expect(
      describeAccountMovement(movement({ kind: "debt_advance" }))
    ).toMatchObject({ title: "Avance · Visa", increases: true })
  })

  it("distingue aporte y retiro de meta por el signo", () => {
    expect(
      describeAccountMovement(
        movement({ kind: "goal_contribution", name: "Viaje" })
      )
    ).toMatchObject({ title: "Aporte · Viaje", increases: false })
    expect(
      describeAccountMovement(
        movement({ kind: "goal_contribution", name: "Viaje", amount: -20 })
      )
    ).toMatchObject({ title: "Retiro · Viaje", increases: true })
  })
})

describe("accountMovementDeletedText", () => {
  it("nombra lo que se eliminó", () => {
    expect(accountMovementDeletedText(movement({ kind: "debt_payment" }))).toBe(
      "Pago eliminado"
    )
    expect(
      accountMovementDeletedText(
        movement({ kind: "debt_payment", is_extra_payment: true })
      )
    ).toBe("Abono eliminado")
    expect(accountMovementDeletedText(movement({ kind: "debt_advance" }))).toBe(
      "Avance eliminado"
    )
    expect(
      accountMovementDeletedText(
        movement({ kind: "goal_contribution", amount: -1 })
      )
    ).toBe("Retiro eliminado")
    expect(
      accountMovementDeletedText(movement({ kind: "goal_contribution" }))
    ).toBe("Aporte eliminado")
  })
})

describe("linkedPaymentNoun", () => {
  it("avance, cobro o pago", () => {
    expect(
      linkedPaymentNoun({ kind: "advance", debt_kind: "credit_card" })
    ).toBe("avance")
    expect(
      linkedPaymentNoun({ kind: "payment", debt_kind: "receivable" })
    ).toBe("cobro")
    expect(linkedPaymentNoun({ kind: "payment", debt_kind: "loan" })).toBe(
      "pago"
    )
  })
})

describe("rowTitle", () => {
  it("usa la descripción o el tipo de fila", () => {
    expect(rowTitle(transaction("t1", "2026-11-20", "Mercado"))).toBe("Mercado")
    expect(rowTitle(transfer("x1", "2026-11-20"))).toBe("Traspaso")
    expect(rowTitle(movement({ kind: "debt_advance" }))).toBe("Avance · Visa")
  })
})

describe("reorderRows", () => {
  const rows = [
    transaction("a", "2026-11-20"),
    transaction("b", "2026-11-20"),
    transaction("c", "2026-11-20")
  ]
  const ids = (list: LedgerEntry[]) => list.map(entryId)

  it("baja la fila al lugar de la destino", () => {
    expect(
      ids(reorderRows(rows, { sourceKey: "expense:a", targetKey: "expense:c" }))
    ).toEqual(["b", "c", "a"])
  })

  it("sube la fila al lugar de la destino", () => {
    expect(
      ids(reorderRows(rows, { sourceKey: "expense:c", targetKey: "expense:a" }))
    ).toEqual(["c", "a", "b"])
  })

  it("deja el orden igual si falta una fila", () => {
    expect(
      reorderRows(rows, { sourceKey: "expense:z", targetKey: "expense:a" })
    ).toBe(rows)
  })
})

describe("rowReorders", () => {
  const rows = [
    transaction("a", "2026-11-20"),
    transfer("b", "2026-11-20"),
    transaction("c", "2026-11-19")
  ]

  it("da la posición en el día y el asa solo con otra fila del día", () => {
    expect(rowReorders(rows, null)).toEqual([
      {
        id: "expense:a",
        day: "2026-11-20",
        index: 0,
        canDrag: true,
        title: "a",
        className: undefined
      },
      {
        id: "transfer:b",
        day: "2026-11-20",
        index: 1,
        canDrag: true,
        title: "Traspaso",
        className: undefined
      },
      {
        id: "expense:c",
        day: "2026-11-19",
        index: 0,
        canDrag: false,
        title: "c",
        className: undefined
      }
    ])
  })

  it("resalta el día que se arrastra y atenúa el resto", () => {
    expect(
      rowReorders(rows, "2026-11-20").map((reorder) => reorder.className)
    ).toEqual(["bg-primary/10", "bg-primary/10", "opacity-40"])
  })
})
