import { describe, expect, it } from "vitest"
import type { CollectableReceivable } from "./receivable-collect"
import {
  collectDescription,
  collectPreview,
  collectToast,
  collectedPeriods,
  initialCollectPeriod,
  monthShortcutOptions,
  receivableSummary,
  remainingOf
} from "./receivable-collect-form-values"

const MONTHLY: CollectableReceivable = {
  id: "ana",
  name: "Ana",
  accountId: null,
  schedule: "monthly",
  balance: 600_000,
  periods: [
    { period_on: "2026-03-01", remaining: 0 },
    { period_on: "2026-04-01", remaining: 50_000 },
    { period_on: "2026-05-01", remaining: 200_000 },
    { period_on: "2026-06-01", remaining: 200_000 },
    { period_on: "2026-07-01", remaining: 150_000 }
  ],
  owedCount: 2,
  owed: 250_000
}

const OPEN = MONTHLY.periods.filter((item) => item.remaining > 0)
const money = (value: number) => `$ ${value}`

describe("cuota y monto", () => {
  it("arranca con la cuota elegida o la más antigua abierta", () => {
    expect(initialCollectPeriod(OPEN, "2026-06-01")).toBe("2026-06-01")
    expect(initialCollectPeriod(OPEN, "2026-03-01")).toBe("2026-04-01")
    expect(initialCollectPeriod(OPEN)).toBe("2026-04-01")
    expect(initialCollectPeriod([])).toBe("")
  })

  it("lo que falta de una cuota abierta", () => {
    expect(remainingOf(OPEN, "2026-04-01")).toBe(50_000)
    expect(remainingOf(OPEN, "2026-03-01")).toBeNull()
  })

  it("toast según el modo", () => {
    expect(collectToast("full")).toBe("Cuenta por cobrar pagada")
    expect(collectToast("allocate")).toBe("Cobro registrado")
  })
})

describe("reparto y descripción", () => {
  it("la vista previa solo existe en Varios meses con monto", () => {
    expect(collectPreview("single", MONTHLY, 300_000)).toBeNull()
    expect(collectPreview("allocate", MONTHLY, 0)).toBeNull()
    expect(collectPreview("allocate", MONTHLY, null)).toBeNull()
    expect(collectPreview("allocate", MONTHLY, 300_000)).toMatchInlineSnapshot(`
      {
        "covered": [
          "2026-04-01",
          "2026-05-01",
        ],
        "error": null,
        "partial": {
          "amount": 50000,
          "key": "2026-06-01",
          "missing": 150000,
        },
      }
    `)
  })

  it("cuotas que toca el cobro según el modo", () => {
    const preview = collectPreview("allocate", MONTHLY, 300_000)
    expect(collectedPeriods("allocate", "", preview)).toMatchInlineSnapshot(`
      [
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
      ]
    `)
    expect(collectedPeriods("single", "2026-05-01", null)).toEqual([
      "2026-05-01"
    ])
    expect(collectedPeriods("single", "", null)).toEqual([])
    expect(collectedPeriods("partial", "2026-05-01", preview)).toEqual(
      collectedPeriods("allocate", "", preview)
    )
    expect(
      collectedPeriods("allocate", "", {
        covered: ["2026-04"],
        partial: null,
        error: "Sobra"
      })
    ).toEqual([])
  })

  it("descripción sugerida", () => {
    expect([
      collectDescription("Ana", []),
      collectDescription("Ana", ["2026-05-01"]),
      collectDescription("Ana", ["2026-04-01", "2026-06-01"])
    ]).toMatchInlineSnapshot(`
      [
        "Cobro Ana",
        "Cobro Ana · mayo",
        "Cobro Ana · abril a junio",
      ]
    `)
  })
})

describe("resumen y atajos", () => {
  it("saldo, al día o cuotas por cobrar", () => {
    expect([
      receivableSummary({ ...MONTHLY, schedule: "once" }, money),
      receivableSummary({ ...MONTHLY, schedule: "once", balance: null }, money),
      receivableSummary({ ...MONTHLY, owedCount: 0 }, money),
      receivableSummary({ ...MONTHLY, owedCount: 1, owed: 50_000 }, money),
      receivableSummary(MONTHLY, money)
    ]).toMatchInlineSnapshot(`
      [
        "Saldo $ 600000",
        "Saldo $ 0",
        "Al día",
        "1 cuota por cobrar · $ 50000",
        "2 cuotas por cobrar · $ 250000",
      ]
    `)
  })

  it("atajos con el monto que falta", () => {
    expect(monthShortcutOptions(MONTHLY)).toMatchInlineSnapshot(`
      [
        {
          "amount": 250000,
          "months": 2,
        },
        {
          "amount": 450000,
          "months": 3,
        },
      ]
    `)
  })
})
