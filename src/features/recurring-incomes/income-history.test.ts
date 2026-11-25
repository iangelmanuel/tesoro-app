import { describe, expect, it } from "vitest"
import {
  type IncomeHistoryAllocation,
  buildIncomeHistory,
  incomeHistoryPageSize,
  nextOpenOccurrence
} from "./income-history"

const SCHEDULE = {
  amount: 1_000_000,
  frequency: "monthly" as const,
  day_of_month: 15,
  second_day_of_month: null,
  month_of_year: null,
  day_of_week: null,
  interval_days: null,
  starts_on: "2026-03-01",
  ends_on: null
}

function allocation(
  due_on: string,
  amount: number,
  id: string,
  occurred_on: string,
  day_position = 0
): IncomeHistoryAllocation {
  return {
    due_on,
    amount,
    transaction: {
      id,
      occurred_on,
      description: `Ingreso ${id}`,
      day_position,
      created_at: `${occurred_on}T12:00:00Z`
    }
  }
}

const ALLOCATIONS = [
  allocation("2026-03-15", 1_000_000, "a", "2026-03-15"),
  allocation("2026-04-15", 300_000, "c", "2026-04-20", 1),
  allocation("2026-04-15", 200_000, "b", "2026-04-20", 0),
  // De una fecha que ya no calza con el calendario
  allocation("2026-04-02", 50_000, "d", "2026-04-02")
]

describe("buildIncomeHistory", () => {
  it("fija ocurrencias, cobros por día, recibido del año y atrasado", () => {
    expect(buildIncomeHistory(SCHEDULE, ALLOCATIONS, "2026-06-10", 12))
      .toMatchInlineSnapshot(`
      {
        "dueToDate": 2450000,
        "hasMore": false,
        "occurrences": [
          {
            "amount": 1000000,
            "dueOn": "2026-06-15",
            "receipts": [],
            "receivedAmount": 0,
            "remaining": 1000000,
            "status": "pending",
          },
          {
            "amount": 1000000,
            "dueOn": "2026-05-15",
            "receipts": [],
            "receivedAmount": 0,
            "remaining": 1000000,
            "status": "overdue",
          },
          {
            "amount": 1000000,
            "dueOn": "2026-04-15",
            "receipts": [
              {
                "amount": 200000,
                "description": "Ingreso b",
                "occurredOn": "2026-04-20",
                "transactionId": "b",
              },
              {
                "amount": 300000,
                "description": "Ingreso c",
                "occurredOn": "2026-04-20",
                "transactionId": "c",
              },
            ],
            "receivedAmount": 500000,
            "remaining": 500000,
            "status": "partial",
          },
          {
            "amount": 1000000,
            "dueOn": "2026-04-02",
            "receipts": [
              {
                "amount": 50000,
                "description": "Ingreso d",
                "occurredOn": "2026-04-02",
                "transactionId": "d",
              },
            ],
            "receivedAmount": 50000,
            "remaining": 950000,
            "status": "partial",
          },
          {
            "amount": 1000000,
            "dueOn": "2026-03-15",
            "receipts": [
              {
                "amount": 1000000,
                "description": "Ingreso a",
                "occurredOn": "2026-03-15",
                "transactionId": "a",
              },
            ],
            "receivedAmount": 1000000,
            "remaining": 0,
            "status": "received",
          },
        ],
        "receivedThisYear": 1550000,
      }
    `)
  })

  it("corta en `limit` y avisa que hay más", () => {
    const history = buildIncomeHistory(SCHEDULE, ALLOCATIONS, "2026-06-10", 2)
    expect(history.occurrences.map((row) => row.dueOn)).toEqual([
      "2026-06-15",
      "2026-05-15"
    ])
    expect(history.hasMore).toBe(true)
  })
})

describe("nextOpenOccurrence", () => {
  it("la abierta más antigua, con la lista de la más reciente a la más antigua", () => {
    expect(
      nextOpenOccurrence([
        { dueOn: "2026-06-15", status: "pending" as const },
        { dueOn: "2026-05-15", status: "partial" as const },
        { dueOn: "2026-04-15", status: "received" as const }
      ])?.dueOn
    ).toBe("2026-05-15")
    expect(nextOpenOccurrence([{ status: "received" as const }])).toBeNull()
  })
})

describe("incomeHistoryPageSize", () => {
  it("31 en la diaria y 12 en las demás", () => {
    expect(incomeHistoryPageSize("daily")).toBe(31)
    expect(incomeHistoryPageSize("monthly")).toBe(12)
  })
})
