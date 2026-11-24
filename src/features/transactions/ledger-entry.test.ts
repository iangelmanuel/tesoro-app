import { describe, expect, it } from "vitest"
import type { Database } from "@/types/database"
import {
  type ParentLink,
  type TransactionLinks,
  isAccountMovementKind,
  toLedgerEntry
} from "./ledger-entry"

type LedgerEntryRow = Database["public"]["Views"]["ledger_entries"]["Row"]

function row(fields: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: "e1",
    kind: "expense",
    amount: 1000,
    occurred_on: "2026-11-20",
    occurred_time: null,
    day_position: 0,
    account_id: "a1",
    to_account_id: null,
    category_id: "c1",
    description: "Mercado",
    note: null,
    counterparty: null,
    invoice_ref: null,
    ...fields
  } as LedgerEntryRow
}

const NO_LINKS = new Map<string, TransactionLinks>()
const NO_PARENTS = new Map<string, ParentLink>()

describe("isAccountMovementKind", () => {
  it("reconoce pagos, avances y aportes", () => {
    expect(isAccountMovementKind("debt_payment")).toBe(true)
    expect(isAccountMovementKind("debt_advance")).toBe(true)
    expect(isAccountMovementKind("goal_contribution")).toBe(true)
  })

  it("descarta lo demás", () => {
    expect(isAccountMovementKind("income")).toBe(false)
    expect(isAccountMovementKind("transfer")).toBe(false)
    expect(isAccountMovementKind(null)).toBe(false)
  })
})

describe("toLedgerEntry", () => {
  it("arma un traspaso con origen y destino", () => {
    expect(
      toLedgerEntry(
        row({
          kind: "transfer",
          amount: "50.5" as unknown as number,
          to_account_id: "a2",
          note: "ahorro",
          occurred_time: "08:30:00",
          day_position: 2
        }),
        NO_LINKS,
        NO_PARENTS
      )
    ).toEqual({
      occurred_time: "08:30:00",
      day_position: 2,
      kind: "transfer",
      id: "e1",
      amount: 50.5,
      occurred_on: "2026-11-20",
      note: "ahorro",
      from_account_id: "a1",
      to_account_id: "a2"
    })
  })

  it("arma un ajuste", () => {
    expect(
      toLedgerEntry(
        row({ kind: "adjustment", amount: -20 }),
        NO_LINKS,
        NO_PARENTS
      )
    ).toEqual({
      occurred_time: null,
      day_position: 0,
      kind: "adjustment",
      id: "e1",
      amount: -20,
      occurred_on: "2026-11-20",
      note: null,
      account_id: "a1"
    })
  })

  it("arma un pago con cuenta y su padre", () => {
    const parents = new Map<string, ParentLink>([
      ["e1", { parentId: "d1", isExtraPayment: true, isActive: true }]
    ])
    expect(
      toLedgerEntry(
        row({ kind: "debt_payment", description: "Visa" }),
        NO_LINKS,
        parents
      )
    ).toMatchObject({
      kind: "debt_payment",
      name: "Visa",
      parent_id: "d1",
      is_extra_payment: true,
      parent_active: true
    })
  })

  it("sin padre conocido deja valores vacíos", () => {
    expect(
      toLedgerEntry(
        row({ kind: "goal_contribution", description: null }),
        NO_LINKS,
        NO_PARENTS
      )
    ).toMatchObject({
      name: "",
      parent_id: "",
      is_extra_payment: false,
      parent_active: false
    })
  })

  it("arma un movimiento con sus enlaces", () => {
    const links = new Map<string, TransactionLinks>([
      [
        "e1",
        {
          recurringExpenseId: "r1",
          recurringIncomeId: null,
          recurringIncomeAllocations: [],
          debtEntry: null
        }
      ]
    ])
    expect(toLedgerEntry(row({}), links, NO_PARENTS)).toEqual({
      occurred_time: null,
      day_position: 0,
      kind: "expense",
      debt_entry: null,
      transaction: {
        id: "e1",
        type: "expense",
        amount: 1000,
        occurred_on: "2026-11-20",
        occurred_time: null,
        category_id: "c1",
        description: "Mercado",
        note: null,
        account_id: "a1",
        counterparty: null,
        invoice_ref: null,
        recurring_expense_id: "r1",
        recurring_income_id: null,
        recurring_income_allocations: []
      }
    })
  })

  it("sin enlaces deja el movimiento suelto", () => {
    expect(
      toLedgerEntry(row({ kind: "income" }), NO_LINKS, NO_PARENTS)
    ).toMatchObject({
      kind: "income",
      debt_entry: null,
      transaction: {
        recurring_expense_id: null,
        recurring_income_id: null,
        recurring_income_allocations: []
      }
    })
  })
})
