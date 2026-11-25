import { describe, expect, it } from "vitest"
import { debtEntryFixture } from "@/testing/fixtures"
import {
  type Installment,
  type InstallmentRate,
  buildInstallments,
  collectedInYear,
  getInstallmentStatus,
  installmentAmountFor,
  installmentDueOn,
  lastPeriodOn,
  owedOnOpenEnded,
  periodOf,
  periodPayments,
  receivableInstallments,
  summarizeInstallments
} from "./receivable-schedule"

// Tests de caracterización (SPEC 55b): fijan las cuotas de una cuenta por
// cobrar mensual (SPEC 28, 29 y 39) antes de partir la feature

const TODAY = "2026-06-15"

const RECEIVABLE = {
  starts_on: "2026-03-01",
  due_day: 31,
  term_months: 6,
  installment: 200_000,
  installment_history: [] as InstallmentRate[]
}

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
  }),
  debtEntryFixture({
    id: "c",
    kind: "adjustment",
    amount: 10_000,
    occurred_on: "2026-05-21"
  })
]

const INSTALLMENTS = buildInstallments(
  RECEIVABLE,
  periodPayments(ENTRIES),
  TODAY
)

/** Una cuota en una línea: periodo, vencimiento, estado, montos y abonos */
function row(item: Installment) {
  const entries = item.entries.map((entry) => entry.id).join()
  return `${item.period_on} ${item.due_on} ${item.status} ${item.paid}/${item.expected} falta ${item.remaining} [${entries}]`
}

describe("fechas y valores", () => {
  it("periodOf, installmentDueOn y lastPeriodOn", () => {
    expect(periodOf("2026-06-15")).toBe("2026-06-01")
    expect(installmentDueOn("2026-02-01", 31)).toBe("2026-02-28")
    expect(installmentDueOn("2026-04-01", 31)).toBe("2026-04-30")
    expect(lastPeriodOn(RECEIVABLE)).toBe("2026-08-01")
    expect(lastPeriodOn({ ...RECEIVABLE, term_months: null })).toBeNull()
  })

  it("installmentAmountFor usa el valor anterior que cubre el mes", () => {
    const history = [
      { through_period: "2026-04-01", amount: 150_000 },
      { through_period: "2026-02-01", amount: 100_000 }
    ]
    const receivable = { installment: 200_000, installment_history: history }
    expect(installmentAmountFor(receivable, "2026-01-01")).toBe(100_000)
    expect(installmentAmountFor(receivable, "2026-03-01")).toBe(150_000)
    expect(installmentAmountFor(receivable, "2026-05-01")).toBe(200_000)
  })

  it("getInstallmentStatus", () => {
    expect(getInstallmentStatus("2026-06-30", 100, 100, TODAY)).toBe("paid")
    expect(getInstallmentStatus("2026-06-30", 100, 40, TODAY)).toBe("partial")
    expect(getInstallmentStatus("2026-06-14", 100, 0, TODAY)).toBe("overdue")
    expect(getInstallmentStatus("2026-06-15", 100, 0, TODAY)).toBe("pending")
  })
})

describe("buildInstallments y summarizeInstallments", () => {
  it("fija las cuotas hasta el mes siguiente al actual", () => {
    expect(INSTALLMENTS.map(row)).toMatchInlineSnapshot(`
      [
        "2026-03-01 2026-03-31 paid 200000/200000 falta 0 [a]",
        "2026-04-01 2026-04-30 paid 200000/200000 falta 0 [a]",
        "2026-05-01 2026-05-31 partial 50000/200000 falta 150000 [b]",
        "2026-06-01 2026-06-30 pending 0/200000 falta 200000 []",
        "2026-07-01 2026-07-31 pending 0/200000 falta 200000 []",
      ]
    `)
  })

  it("resume atrasadas, lo debido y la próxima", () => {
    const summary = summarizeInstallments(INSTALLMENTS, TODAY)
    expect(summary.overdueCount).toBe(1)
    expect(summary.owed).toBe(350_000)
    expect(summary.next?.period_on).toBe("2026-06-01")
  })

  it("un adelanto alarga la lista hasta su cuota", () => {
    const advance = buildInstallments(
      RECEIVABLE,
      [
        {
          id: "x",
          amount: 200_000,
          occurred_on: "2026-06-01",
          allocations: [{ period_on: "2026-08-01", amount: 200_000 }]
        }
      ],
      TODAY
    )
    expect(advance.at(-1)?.period_on).toBe("2026-08-01")
  })

  it("si empieza en el futuro incluye al menos la primera cuota", () => {
    expect(
      buildInstallments(
        { ...RECEIVABLE, starts_on: "2027-01-01" },
        [],
        TODAY
      ).map((item) => item.period_on)
    ).toEqual(["2027-01-01"])
  })
})

describe("desde la fila de la consulta", () => {
  it("receivableInstallments exige inicio, día y valor", () => {
    expect(
      receivableInstallments({ ...RECEIVABLE, due_day: null }, ENTRIES, TODAY)
    ).toEqual([])
    expect(receivableInstallments(RECEIVABLE, ENTRIES, TODAY)).toEqual(
      INSTALLMENTS
    )
  })

  it("owedOnOpenEnded suma solo las mensuales indefinidas activas", () => {
    const base = {
      ...RECEIVABLE,
      term_months: null,
      kind: "receivable",
      status: "active",
      schedule: "monthly"
    }
    expect(
      owedOnOpenEnded(
        [
          { ...base, id: "open" },
          { ...base, id: "fixed", term_months: 6 },
          { ...base, id: "archived", status: "archived" }
        ],
        { open: ENTRIES, fixed: ENTRIES, archived: ENTRIES },
        TODAY
      )
    ).toBe(350_000)
  })

  it("collectedInYear suma por fecha del cobro", () => {
    expect(collectedInYear(periodPayments(ENTRIES), TODAY)).toBe(450_000)
    expect(collectedInYear(periodPayments(ENTRIES), "2027-01-01")).toBe(0)
  })
})
