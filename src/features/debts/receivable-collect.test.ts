import { describe, expect, it } from "vitest"
import { debtEntryFixture, debtFixture } from "@/testing/fixtures"
import {
  amountForMonths,
  collectPeriods,
  describeMonths,
  lastCoveredPeriod,
  nextPendingInstallment,
  openPeriods,
  previewCollection,
  shortMonth,
  toCollectableReceivable
} from "./receivable-collect"

// Tests de caracterización (SPEC 55b): fijan el cobro de una cuenta por
// cobrar (SPEC 39) antes de partir la feature

const TODAY = "2026-06-15"

const MONTHLY = debtFixture({
  id: "ana",
  name: "Ana",
  kind: "receivable",
  schedule: "monthly",
  account_id: "bank",
  starts_on: "2026-03-01",
  due_day: 10,
  term_months: 6,
  installment: 200_000,
  balance: 750_000
})

/** Mensual indefinida: cobra 12 meses por delante del actual */
const OPEN_MONTHLY = { ...MONTHLY, term_months: null }

const ENTRIES = [
  debtEntryFixture({
    id: "a",
    amount: 400_000,
    occurred_on: "2026-04-02",
    allocations: [
      { period_on: "2026-03-01", amount: 200_000 },
      { period_on: "2026-04-01", amount: 200_000 }
    ]
  }),
  debtEntryFixture({
    id: "b",
    amount: 50_000,
    occurred_on: "2026-05-20",
    allocations: [{ period_on: "2026-05-01", amount: 50_000 }]
  })
]

const COLLECTABLE = toCollectableReceivable(MONTHLY, ENTRIES, TODAY)

describe("collectPeriods", () => {
  it("lo que falta de cada cuota hasta la última", () => {
    expect(collectPeriods(MONTHLY, ENTRIES, TODAY)).toMatchInlineSnapshot(`
      [
        {
          "period_on": "2026-03-01",
          "remaining": 0,
        },
        {
          "period_on": "2026-04-01",
          "remaining": 0,
        },
        {
          "period_on": "2026-05-01",
          "remaining": 150000,
        },
        {
          "period_on": "2026-06-01",
          "remaining": 200000,
        },
        {
          "period_on": "2026-07-01",
          "remaining": 200000,
        },
        {
          "period_on": "2026-08-01",
          "remaining": 200000,
        },
      ]
    `)
  })

  it("sin el abono que se edita y, en una indefinida, 12 meses adelante", () => {
    expect(collectPeriods(MONTHLY, ENTRIES, TODAY, "b")[2]).toEqual({
      period_on: "2026-05-01",
      remaining: 200_000
    })
    const open = collectPeriods(OPEN_MONTHLY, [], TODAY)
    expect(open.at(-1)?.period_on).toBe("2027-06-01")
  })
})

describe("toCollectableReceivable", () => {
  it("mensual con saldo total y lo debido", () => {
    expect({ ...COLLECTABLE, periods: COLLECTABLE.periods.length })
      .toMatchInlineSnapshot(`
        {
          "accountId": "bank",
          "balance": 750000,
          "id": "ana",
          "name": "Ana",
          "owed": 350000,
          "owedCount": 2,
          "periods": 6,
          "schedule": "monthly",
        }
      `)
  })

  it("de cobro único no tiene cuotas", () => {
    expect(
      toCollectableReceivable(
        { ...MONTHLY, schedule: "once", balance: 300_000 },
        [],
        TODAY
      )
    ).toMatchObject({ schedule: "once", balance: 300_000, periods: [] })
  })
})

describe("cuotas abiertas", () => {
  it("openPeriods, nextPendingInstallment y lastCoveredPeriod", () => {
    expect(openPeriods(COLLECTABLE).map((p) => p.period_on)).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01"
    ])
    expect(nextPendingInstallment(COLLECTABLE, null)?.period_on).toBe(
      "2026-05-01"
    )
    expect(nextPendingInstallment(COLLECTABLE, "2026-06-01")?.period_on).toBe(
      "2026-07-01"
    )
    expect(nextPendingInstallment(COLLECTABLE, "2026-08-01")).toBeNull()
    expect(lastCoveredPeriod(ENTRIES[0])).toBe("2026-04-01")
    expect(lastCoveredPeriod(debtEntryFixture({}))).toBeNull()
  })

  it("amountForMonths suma las más antiguas", () => {
    expect(amountForMonths(COLLECTABLE, 2)).toBe(350_000)
    expect(amountForMonths(COLLECTABLE, 5)).toBeNull()
  })
})

describe("previewCollection", () => {
  it("reparte desde la más antigua y deja una abonada", () => {
    expect(previewCollection(COLLECTABLE, 450_000)).toMatchInlineSnapshot(`
      {
        "covered": [
          "2026-05-01",
          "2026-06-01",
        ],
        "error": null,
        "partial": {
          "amount": 100000,
          "key": "2026-07-01",
          "missing": 100000,
        },
      }
    `)
  })

  it("avisa si sobra: fin de las cuotas o tope de meses", () => {
    expect(
      previewCollection(COLLECTABLE, 10_000_000).error
    ).toMatchInlineSnapshot(`"El monto supera lo que falta por cobrar"`)
    const open = toCollectableReceivable(OPEN_MONTHLY, ENTRIES, TODAY)
    expect(previewCollection(open, 100_000_000).error).toMatchInlineSnapshot(
      `"El monto cubre más de 12 meses por delante"`
    )
  })
})

describe("textos de meses", () => {
  it("shortMonth y describeMonths", () => {
    expect(shortMonth("2026-09-01", TODAY)).toBe("sep")
    expect(shortMonth("2027-01-01", TODAY)).toBe("ene 2027")
    expect([
      describeMonths([], TODAY),
      describeMonths(["2026-09-01"], TODAY),
      describeMonths(["2026-09-01", "2026-10-01", "2026-11-01"], TODAY),
      describeMonths(
        [
          "2026-09-01",
          "2026-10-01",
          "2026-11-01",
          "2026-12-01",
          "2027-01-01",
          "2027-02-01"
        ],
        TODAY
      )
    ]).toMatchInlineSnapshot(`
      [
        "",
        "sep",
        "sep, oct y nov",
        "6 meses, de sep a feb 2027",
      ]
    `)
  })
})
