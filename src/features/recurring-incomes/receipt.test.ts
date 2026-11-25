import { describe, expect, it } from "vitest"
import {
  amountDueUntil,
  canDuplicateReceipt,
  describeOccurrences,
  describeSavedReceipt,
  futureWindowEnd,
  incomeReceiptDescription,
  incomeReceiptPeriods,
  incomeReceiptValues,
  previewIncomeReceipt
} from "./receipt"
import type { IncomeFrequency } from "./schemas"
import type { IncomeAllocation } from "./types"

// Tests de caracterización (SPEC 55b): fijan el reparto y el prellenado de
// recibir un ingreso fijo (diálogo de movimiento y receive_recurring_income)

const TODAY = "2026-06-15"

const SALARY = {
  frequency: "biweekly" as IncomeFrequency,
  amount: 1_000_000,
  day_of_month: 15,
  second_day_of_month: 30,
  month_of_year: null,
  day_of_week: null,
  interval_days: 3,
  starts_on: "2026-05-01",
  ends_on: null as string | null
}

// 15 de mayo recibida, 30 de mayo abonada
const RECEIVED = new Map([
  ["2026-05-15", 1_000_000],
  ["2026-05-30", 400_000]
])

const SOURCE = incomeReceiptPeriods(SALARY, RECEIVED, TODAY)
const NAMED = { ...SOURCE, name: "Salario", frequency: SALARY.frequency }

describe("fechas", () => {
  it("futureWindowEnd", () => {
    const frequencies: IncomeFrequency[] = [
      "yearly",
      "monthly",
      "weekly",
      "daily",
      "every_n_days"
    ]
    expect(
      frequencies.map((frequency) =>
        futureWindowEnd({ ...SALARY, frequency }, TODAY)
      )
    ).toMatchInlineSnapshot(`
      [
        "2039-06-15",
        "2027-07-15",
        "2026-09-14",
        "2026-06-28",
        "2026-07-24",
      ]
    `)
  })
})

describe("incomeReceiptPeriods", () => {
  it("vencidas con faltante y las 12 futuras", () => {
    expect(SOURCE.futureLimited).toBe(true)
    expect(SOURCE.periods.slice(0, 3)).toEqual([
      { key: "2026-05-30", due: 600_000 },
      { key: "2026-06-15", due: 1_000_000 },
      { key: "2026-06-30", due: 1_000_000 }
    ])
    expect(SOURCE.periods).toHaveLength(14)
  })

  it("con fin cercano no choca con el tope", () => {
    const short = incomeReceiptPeriods(
      { ...SALARY, ends_on: "2026-07-31" },
      RECEIVED,
      TODAY
    )
    expect(short.futureLimited).toBe(false)
    expect(short.periods.map((period) => period.key)).toEqual([
      "2026-05-30",
      "2026-06-15",
      "2026-06-30",
      "2026-07-15",
      "2026-07-30"
    ])
  })

  it("sin fecha fija no tiene periodos", () => {
    expect(
      incomeReceiptPeriods({ ...SALARY, frequency: "none" }, RECEIVED, TODAY)
    ).toEqual({ periods: [], futureLimited: false })
  })
})

describe("previewIncomeReceipt", () => {
  it("reparte desde la más antigua y deja una abonada", () => {
    expect(previewIncomeReceipt(SOURCE, 2_000_000)).toMatchInlineSnapshot(`
      {
        "allocations": [
          {
            "amount": 600000,
            "key": "2026-05-30",
          },
          {
            "amount": 1000000,
            "key": "2026-06-15",
          },
          {
            "amount": 400000,
            "key": "2026-06-30",
          },
        ],
        "covered": [
          "2026-05-30",
          "2026-06-15",
        ],
        "error": null,
        "partial": {
          "amount": 400000,
          "key": "2026-06-30",
        },
      }
    `)
  })

  it("al editar, lo propio vuelve a contar como faltante", () => {
    const own = [
      { due_on: "2026-05-30", amount: 400_000 }
    ] as IncomeAllocation[]
    const preview = previewIncomeReceipt(SOURCE, 1_000_000, own)
    expect(preview.covered).toEqual(["2026-05-30"])
    expect(preview.error).toBeNull()
  })

  it("avisa si sobra monto por el tope o por el fin", () => {
    expect(previewIncomeReceipt(SOURCE, 100_000_000).error).toBe(
      "El monto cubre más de 12 periodos futuros"
    )
    const short = incomeReceiptPeriods(
      { ...SALARY, ends_on: "2026-06-30" },
      RECEIVED,
      TODAY
    )
    expect(previewIncomeReceipt(short, 10_000_000).error).toBe(
      "El monto supera lo que falta por recibir de este ingreso fijo"
    )
  })
})

describe("montos y textos", () => {
  it("amountDueUntil suma lo abierto hasta una fecha", () => {
    expect(amountDueUntil(SOURCE, "2026-06-15")).toBe(1_600_000)
  })

  it("describeOccurrences y describeSavedReceipt", () => {
    expect(
      describeOccurrences(["2026-11-01", "2026-11-08"])
    ).toMatchInlineSnapshot(`"dom 1 nov, dom 8 nov"`)
    expect(
      describeOccurrences([
        "2026-11-01",
        "2026-11-08",
        "2026-11-15",
        "2026-11-22"
      ])
    ).toMatchInlineSnapshot(`"4 periodos, del dom 1 nov al dom 22 nov"`)
    expect(describeSavedReceipt([])).toBeNull()
  })

  it("incomeReceiptDescription con y sin fila", () => {
    expect([
      incomeReceiptDescription(NAMED),
      incomeReceiptDescription(NAMED, "2026-06-15"),
      incomeReceiptDescription({ ...NAMED, frequency: "daily" }, "2026-05-30"),
      incomeReceiptDescription({ ...NAMED, frequency: "none" })
    ]).toMatchInlineSnapshot(`
      [
        "Ingreso Salario · 2.ª quincena de mayo",
        "Ingreso Salario · mayo a junio",
        "Ingreso Salario · 30 may",
        "Ingreso Salario",
      ]
    `)
  })

  it("incomeReceiptValues prellena con categoría y cuenta activas", () => {
    const source = {
      ...NAMED,
      amount: 1_000_000,
      category_id: "salary",
      account_id: "bank"
    }
    expect(
      incomeReceiptValues(source, {
        categories: [{ id: "salary", type: "income", archived_at: null }],
        accounts: [{ id: "bank", archived_at: null }]
      })
    ).toMatchInlineSnapshot(`
      {
        "account_id": "bank",
        "amount": 1000000,
        "category_id": "salary",
        "description": "Ingreso Salario · 2.ª quincena de mayo",
      }
    `)
    expect(
      incomeReceiptValues(source, {
        categories: [{ id: "salary", type: "expense", archived_at: null }],
        accounts: [{ id: "bank", archived_at: "2026-01-01" }]
      })
    ).toMatchObject({ category_id: null, account_id: null })
  })
})

describe("canDuplicateReceipt", () => {
  it("duplicar pide una fuente activa con un periodo abierto", () => {
    expect(canDuplicateReceipt(undefined)).toBe(false)
    expect(canDuplicateReceipt({ frequency: "none", periods: [] })).toBe(true)
    expect(
      canDuplicateReceipt({ frequency: "monthly", periods: [{ due: 0 }] })
    ).toBe(false)
    expect(
      canDuplicateReceipt({ frequency: "monthly", periods: [{ due: 10 }] })
    ).toBe(true)
  })
})
