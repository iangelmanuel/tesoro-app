import { describe, expect, it } from "vitest"
import { accountFixture, isoWeeks } from "@/testing/fixtures"
import {
  BUSINESS_MONTHS,
  businessMonthsFixture
} from "@/testing/score-fixtures"
import {
  type BusinessRecommendationInputs,
  buildBusinessRecommendations
} from "./recommendations"
import type { BusinessScoreInputs } from "./types"

// Tests de caracterización (SPEC 55b): fijan la lista completa de
// recomendaciones de Empresa y su orden antes de partir el módulo

const SCORE: BusinessScoreInputs = {
  today: "2026-06-15",
  firstTransactionOn: "2025-09-03",
  // Solo de enero a junio de 2026
  ...businessMonthsFixture(BUSINESS_MONTHS.slice(-6)),
  activeWeeks: new Set(isoWeeks("2026-03-02", "2026-06-15", 3))
}

const INPUTS: BusinessRecommendationInputs = {
  workspace: { id: "biz", type: "business", currency: "COP" },
  score: SCORE,
  accounts: [
    accountFixture({
      id: "nequi",
      name: "Nequi",
      kind: "wallet",
      balance: -80_000
    }),
    accountFixture({ id: "bank", name: "Banco", balance: 3_000_000 })
  ],
  salesByClient: [
    { counterparty: "  Tienda La Esquina ", total: 14_000_000, txCount: 9 },
    { counterparty: "Otro cliente", total: 10_000_000, txCount: 4 }
  ],
  monthTotals: { income: 4_000_000, expense: 5_000_000, balance: -1_000_000 },
  withoutAccountTotals: { income: 1_500_000, expense: 1_500_000, balance: 0 }
}

describe("buildBusinessRecommendations", () => {
  it("fija la lista completa y su orden con todas las reglas", () => {
    expect(buildBusinessRecommendations(INPUTS)).toMatchInlineSnapshot(`
      [
        {
          "amount": 5833333.333333334,
          "entityKey": "workspace",
          "evidence": "Tu saldo en cuentas cubre 0,3 meses de salidas",
          "href": "/dashboard/business/biz/cash-flow",
          "linkLabel": "Ir a Flujo de caja",
          "rule": "low_liquidity",
          "severity": "high",
          "title": "Tu liquidez es baja",
        },
        {
          "amount": 1000000,
          "entityKey": "2026-05",
          "evidence": "En mayo tus salidas superaron tus entradas en $ 1.000.000",
          "href": "/dashboard/business/biz/reports?period=month&value=2026-05&type=expense",
          "linkLabel": "Ir a Reportes",
          "rule": "loss_month",
          "severity": "high",
          "title": "Tus salidas superaron tus entradas",
        },
        {
          "amount": 80000,
          "entityKey": "nequi",
          "evidence": "Nequi tiene saldo de −$ 80.000",
          "href": "/dashboard/business/biz/accounts",
          "linkLabel": "Ir a Cuentas",
          "rule": "negative_account",
          "severity": "high",
          "title": "La cuenta Nequi está en negativo",
        },
        {
          "amount": 14000000,
          "entityKey": "tienda la esquina",
          "evidence": "Tienda La Esquina es el 58 % de tus entradas de los últimos 3 meses",
          "href": "/dashboard/business/biz/transactions?month=all&type=income&q=Tienda+La+Esquina",
          "linkLabel": "Ir a Movimientos",
          "rule": "client_concentration",
          "severity": "medium",
          "title": "Dependes mucho de Tienda La Esquina",
        },
        {
          "amount": 3000000,
          "entityKey": "2026-05",
          "evidence": "Vendiste $ 8.000.000 en mayo vs. $ 11.000.000 de promedio (−27 %)",
          "href": "/dashboard/business/biz/reports?period=month&value=2026-05&type=income",
          "linkLabel": "Ir a Reportes",
          "rule": "sales_drop",
          "severity": "medium",
          "title": "Tus entradas bajaron",
        },
        {
          "amount": 2000000,
          "entityKey": "payroll",
          "evidence": "Nómina: $ 6.000.000 en mayo vs. $ 4.000.000 de promedio (+50 %)",
          "href": "/dashboard/business/biz/transactions?month=2026-05&type=expense&category=payroll",
          "linkLabel": "Ir a Movimientos",
          "rule": "cost_growth",
          "severity": "medium",
          "title": "Nómina subió más de lo usual",
        },
        {
          "amount": 1400000,
          "entityKey": "workspace",
          "evidence": "Tu margen de los últimos 3 meses es 4,2 %",
          "href": "/dashboard/business/biz/reports",
          "linkLabel": "Ir a Reportes",
          "rule": "low_margin",
          "severity": "medium",
          "title": "Tu margen es bajo",
        },
        {
          "amount": 13000000,
          "entityKey": "payroll",
          "evidence": "Nómina es el 57 % de tus salidas de los últimos 3 meses",
          "href": "/dashboard/business/biz/reports?type=expense",
          "linkLabel": "Ir a Reportes",
          "rule": "cost_concentration",
          "severity": "low",
          "title": "Nómina concentra tus salidas",
        },
        {
          "amount": 3000000,
          "entityKey": "workspace",
          "evidence": "El 33 % de lo que registraste este mes no tiene cuenta",
          "href": "/dashboard/business/biz/transactions?month=2026-06&account=none",
          "linkLabel": "Ir a Movimientos",
          "rule": "missing_accounts",
          "severity": "low",
          "title": "Hay movimientos sin cuenta",
        },
        {
          "amount": 0,
          "entityKey": "workspace",
          "evidence": "Registraste movimientos en 4 de 12 semanas",
          "href": "/dashboard/business/biz/transactions",
          "linkLabel": "Ir a Movimientos",
          "rule": "irregular_records",
          "severity": "low",
          "title": "Registra tus movimientos con más frecuencia",
        },
      ]
    `)
  })

  it("usa la moneda del espacio en la evidencia", () => {
    const lossMonth = buildBusinessRecommendations({
      ...INPUTS,
      workspace: { ...INPUTS.workspace, currency: "USD" }
    }).find((item) => item.rule === "loss_month")
    expect(lossMonth?.evidence).toMatchInlineSnapshot(
      `"En mayo tus salidas superaron tus entradas en US$ 1.000.000,00"`
    )
  })

  it("no recomienda nada con un negocio sano", () => {
    expect(
      buildBusinessRecommendations({
        ...INPUTS,
        score: {
          ...SCORE,
          ...businessMonthsFixture(
            SCORE.months.map(({ month }) => [
              month,
              10_000_000,
              6_000_000,
              30_000_000,
              2_000_000
            ])
          ),
          activeWeeks: new Set(isoWeeks("2026-03-30", "2026-06-15"))
        },
        accounts: [],
        salesByClient: [
          { counterparty: "A", total: 10_000_000, txCount: 3 },
          { counterparty: "B", total: 10_000_000, txCount: 3 },
          { counterparty: "C", total: 10_000_000, txCount: 3 }
        ],
        withoutAccountTotals: { income: 0, expense: 0, balance: 0 }
      })
    ).toEqual([])
  })
})
