import { describe, expect, it } from "vitest"
import { debtFixture } from "@/testing/fixtures"
import {
  type DebtEntryLite,
  type LoadedMovement,
  businessMonth,
  dateOf,
  debtBalanceAt,
  debtClosedBefore,
  exportBounds,
  groupByMonth,
  monthBounds,
  receivableMonthRow,
  receivableStatus,
  sumCents,
  summaryBalances,
  toRow
} from "./export-calculations"

const TODAY = "2026-11-20"

const movement = (fields: Partial<LoadedMovement>): LoadedMovement => ({
  id: "m",
  source: "expense",
  month: "2026-10",
  date: "2026-10-05",
  time: null,
  kind: "Salida",
  description: "Mercado",
  category: "Comida",
  account: "Banco",
  destination: null,
  note: null,
  amount: 100,
  ...fields
})

const entry = (fields: Partial<DebtEntryLite>): DebtEntryLite => ({
  id: "e",
  debt_id: "debt",
  kind: "payment",
  amount: 0,
  occurred_on: "2026-10-01",
  allocations: [],
  ...fields
})

describe("fechas del rango", () => {
  it("exportBounds corta el mes en curso en hoy", () => {
    expect(
      exportBounds({ from: "2026-09", to: "2026-11", months: [] }, TODAY)
    ).toEqual({ from: "2026-09-01", to: TODAY })
    expect(
      exportBounds({ from: "2026-09", to: "2026-10", months: [] }, TODAY)
    ).toEqual({ from: "2026-09-01", to: "2026-10-31" })
  })

  it("monthBounds corta en el fin del rango", () => {
    expect(monthBounds("2026-11", { to: TODAY })).toEqual({
      from: "2026-11-01",
      to: TODAY
    })
    expect(monthBounds("2026-02", { to: TODAY })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28"
    })
  })

  it("dateOf da el día en Bogotá", () => {
    expect(dateOf("2026-11-01T03:00:00Z")).toBe("2026-10-31")
  })
})

describe("sumas y grupos", () => {
  it("sumCents redondea a centavos", () => {
    expect(sumCents([0.1, 0.2])).toBe(0.3)
  })

  it("groupByMonth conserva el orden", () => {
    const rows = [
      { month: "2026-10", n: 1 },
      { month: "2026-11", n: 2 },
      { month: "2026-10", n: 3 }
    ]
    expect([...groupByMonth(rows)]).toEqual([
      ["2026-10", [rows[0], rows[2]]],
      ["2026-11", [rows[1]]]
    ])
  })

  it("summaryBalances suma saldos de las cuentas", () => {
    expect(
      summaryBalances([
        { name: "A", opening: 10.1, inflow: 0, outflow: 0, closing: 20.2 },
        { name: "B", opening: 5, inflow: 0, outflow: 0, closing: 0.1 }
      ])
    ).toEqual({ openingBalance: 15.1, closingBalance: 20.3 })
  })
})

describe("toRow", () => {
  it("quita los campos internos", () => {
    expect(toRow(movement({}))).not.toHaveProperty("id")
    expect(toRow(movement({}))).not.toHaveProperty("source")
    expect(toRow(movement({}))).not.toHaveProperty("counterparty")
  })

  it("Empresa conserva contraparte y factura", () => {
    expect(
      toRow(movement({ counterparty: "Cliente", invoiceRef: null }))
    ).toMatchObject({ counterparty: "Cliente", invoiceRef: null })
  })
})

describe("businessMonth", () => {
  it("ventas, costos por categoría de mayor a menor y traspasos", () => {
    const month = businessMonth(
      "2026-10",
      [
        movement({ source: "income", kind: "Entrada", amount: 500 }),
        movement({ amount: 30, category: "Arriendo" }),
        movement({ amount: 70, category: null }),
        movement({ amount: 10, category: "Arriendo" }),
        movement({ source: "transfer", kind: "Traspaso", amount: 5 })
      ],
      [{ name: "Caja", opening: 100, inflow: 0, outflow: 0, closing: 490 }]
    )
    expect(month.summary).toEqual({
      sales: 500,
      costs: 110,
      openingBalance: 100,
      closingBalance: 490
    })
    expect(month.costsByCategory).toEqual([
      { category: "Sin categoría", total: 70 },
      { category: "Arriendo", total: 40 }
    ])
    expect(month.sales).toHaveLength(1)
    expect(month.transfers).toHaveLength(1)
  })
})

describe("deudas", () => {
  const debt = debtFixture({ opening_balance: 1000 })

  it("debtBalanceAt resta abonos y suma cargos hasta la fecha", () => {
    const entries = [
      entry({ amount: 300, occurred_on: "2026-10-05" }),
      entry({ kind: "charge", amount: 50, occurred_on: "2026-10-10" }),
      entry({ amount: 100, occurred_on: "2026-11-05" })
    ]
    expect(debtBalanceAt(debt, entries, "2026-10-31")).toBe(750)
    expect(debtBalanceAt(debt, entries, "2026-11-30")).toBe(650)
  })

  it("debtClosedBefore solo si se cerró antes del mes", () => {
    const closed = debtFixture({
      status: "paid",
      closed_at: "2026-09-15T15:00:00Z"
    })
    expect(debtClosedBefore(closed, "2026-10-01")).toBe(true)
    expect(debtClosedBefore(closed, "2026-09-01")).toBe(false)
    expect(debtClosedBefore(debt, "2026-10-01")).toBe(false)
  })

  it("receivableStatus de pago único", () => {
    const pending = debtFixture({ kind: "receivable", balance: 100 })
    expect(receivableStatus(pending, TODAY)).toBe("Pendiente")
    expect(
      receivableStatus({ ...pending, expected_on: "2026-11-01" }, TODAY)
    ).toBe("Atrasada")
    expect(receivableStatus({ ...pending, balance: 0 }, TODAY)).toBe("Cobrada")
    expect(receivableStatus({ ...pending, status: "archived" }, TODAY)).toBe(
      "Archivada"
    )
  })

  it("receivableMonthRow de pago único: esperado el mes de la fecha", () => {
    const receivable = debtFixture({
      kind: "receivable",
      opening_balance: 500,
      balance: 300,
      expected_on: "2026-10-20"
    })
    const entries = [entry({ amount: 200, occurred_on: "2026-10-22" })]
    expect(
      receivableMonthRow(
        receivable,
        entries,
        null,
        {
          month: "2026-10",
          from: "2026-10-01",
          to: "2026-10-31",
          collected: 200
        },
        TODAY
      )
    ).toEqual({
      name: "Deuda",
      expected: 500,
      collected: 200,
      pendingAtClose: 300,
      status: "Atrasada"
    })
  })

  it("receivableMonthRow sin nada en el mes da null", () => {
    const receivable = debtFixture({ kind: "receivable" })
    expect(
      receivableMonthRow(
        receivable,
        [],
        null,
        {
          month: "2026-10",
          from: "2026-10-01",
          to: "2026-10-31",
          collected: 0
        },
        TODAY
      )
    ).toBeNull()
  })
})
