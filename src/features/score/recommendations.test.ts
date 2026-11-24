import { describe, expect, it } from "vitest"
import {
  accountFixture,
  budgetFixture,
  categoryTotalFixture,
  debtFixture,
  goalFixture,
  isoWeeks,
  upcomingPaymentFixture
} from "@/testing/fixtures"
import { monthlyInputFixture } from "@/testing/score-fixtures"
import type { ScoreData } from "./queries"
import { splitDismissed } from "./recommendation-helpers"
import {
  type RecommendationInputs,
  buildRecommendations
} from "./recommendation-rules"

// Tests de caracterización (SPEC 55b): fijan la lista completa de
// recomendaciones y su orden antes de partir el módulo

const SCORE: ScoreData = {
  today: "2026-06-15",
  firstTransactionOn: "2025-09-03",
  months: [
    monthlyInputFixture("2026-02", 3_200_000, 2_600_000, 2_900_000),
    monthlyInputFixture("2026-03", 3_400_000, 3_000_000, 3_300_000),
    monthlyInputFixture("2026-04", 3_400_000, 2_500_000, 4_200_000),
    monthlyInputFixture("2026-05", 3_400_000, 3_900_000, 3_700_000),
    monthlyInputFixture("2026-06", 1_700_000, 1_200_000, 4_200_000)
  ],
  activeWeeks: new Set(isoWeeks("2026-03-02", "2026-06-15", 3)),
  debtBalances: new Map(),
  goalBalances: new Map(),
  debts: [
    debtFixture({
      id: "card",
      name: "Visa",
      kind: "credit_card",
      credit_limit: 5_000_000,
      min_payment: 250_000,
      interest_rate: 28,
      rate_type: "ea",
      balance: 4_000_000,
      next_due_on: "2026-06-20",
      prev_due_on: "2026-05-20",
      paid_current_cycle: 0,
      paid_previous_cycle: 0
    }),
    debtFixture({
      id: "loan",
      name: "Libre inversión",
      installment: 400_000,
      interest_rate: 1.5,
      rate_type: "mv",
      balance: 3_600_000,
      next_due_on: "2026-07-05",
      prev_due_on: "2026-06-05",
      paid_current_cycle: 0,
      paid_previous_cycle: 400_000
    }),
    debtFixture({
      id: "receivable",
      name: "Préstamo a Ana",
      kind: "receivable",
      balance: 500_000,
      interest_rate: 3,
      rate_type: "mv"
    })
  ],
  goals: [
    goalFixture({
      id: "laptop",
      name: "Portátil",
      target_amount: 4_000_000,
      target_date: "2026-08-31",
      saved: 1_700_000
    }),
    goalFixture({
      id: "trip",
      name: "Viaje",
      target_amount: 3_000_000,
      target_date: "2026-12-31",
      created_at: "2026-01-01T15:00:00Z",
      saved: 1_900_000
    })
  ]
}

const INPUTS: RecommendationInputs = {
  score: SCORE,
  lastClosedCategories: [
    categoryTotalFixture("food", "Mercado", 1_200_000),
    categoryTotalFixture("transport", "Transporte", 300_000),
    categoryTotalFixture("new", "Mascotas", 200_000)
  ],
  baseCategories: [
    categoryTotalFixture("food", "Mercado", 2_400_000),
    categoryTotalFixture("transport", "Transporte", 900_000)
  ],
  budgets: [
    budgetFixture("food", "Mercado", 500_000, 600_000),
    budgetFixture("transport", "Transporte", 400_000, 100_000),
    budgetFixture("pets", "Mascotas", null, 80_000),
    budgetFixture("fun", "Salidas", null, 150_000),
    budgetFixture("gifts", "Regalos", null, 60_000),
    budgetFixture("health", "Salud", null, 40_000),
    budgetFixture("books", "Libros", null, 0)
  ],
  upcomingPayments: [
    upcomingPaymentFixture({
      recurringExpenseId: "rent",
      name: "Arriendo",
      amount: 1_500_000,
      dueOn: "2026-06-05",
      status: "overdue"
    }),
    upcomingPaymentFixture({
      recurringExpenseId: "gym",
      name: "Gimnasio",
      amount: 120_000,
      dueOn: "2026-06-25"
    })
  ],
  accounts: [
    accountFixture({
      id: "nequi",
      name: "Nequi",
      kind: "wallet",
      balance: -50_000
    }),
    accountFixture({
      id: "cash",
      name: "Efectivo",
      kind: "cash",
      balance: -10_000
    }),
    accountFixture({ id: "bank", name: "Banco", balance: 2_000_000 })
  ]
}

describe("buildRecommendations", () => {
  it("fija la lista completa y su orden con todas las reglas", () => {
    expect(buildRecommendations(INPUTS)).toMatchInlineSnapshot(`
      [
        {
          "amount": 1500000,
          "entityKey": "recurring:rent:2026-06-05",
          "evidence": "Arriendo venció el 5 de junio ($ 1.500.000)",
          "href": "/dashboard/personal/recurring",
          "linkLabel": "Ir a Gastos fijos",
          "rule": "overdue_payment",
          "severity": "high",
          "title": "Pago vencido de Arriendo",
        },
        {
          "amount": 500000,
          "entityKey": "2026-05",
          "evidence": "En mayo gastaste $ 500.000 más de lo que ingresaste",
          "href": "/dashboard/personal/reports?period=month&value=2026-05&type=expense",
          "linkLabel": "Ir a Reportes",
          "rule": "deficit",
          "severity": "high",
          "title": "Gastaste más de lo que ingresaste",
        },
        {
          "amount": 250000,
          "entityKey": "debt:card",
          "evidence": "Visa venció el 20 de mayo ($ 250.000)",
          "href": "/dashboard/personal/debts",
          "linkLabel": "Ir a Deudas",
          "rule": "overdue_payment",
          "severity": "high",
          "title": "Pago vencido de Visa",
        },
        {
          "amount": 100000,
          "entityKey": "food",
          "evidence": "Mercado: gastaste $ 600.000 de $ 500.000 (120 %)",
          "href": "/dashboard/personal/budgets",
          "linkLabel": "Ir a Presupuestos",
          "rule": "budget_exceeded",
          "severity": "high",
          "title": "Superaste el presupuesto de Mercado",
        },
        {
          "amount": 50000,
          "entityKey": "nequi",
          "evidence": "Nequi tiene saldo de −$ 50.000",
          "href": "/dashboard/personal/accounts",
          "linkLabel": "Ir a Cuentas",
          "rule": "negative_account",
          "severity": "high",
          "title": "La cuenta Nequi está en negativo",
        },
        {
          "amount": 5200000,
          "entityKey": "workspace",
          "evidence": "Tu balance cubre 1,3 meses de salidas",
          "href": "/dashboard/personal/goals",
          "linkLabel": "Ir a Metas",
          "rule": "low_cushion",
          "severity": "medium",
          "title": "Tu colchón es bajo",
        },
        {
          "amount": 2500000,
          "entityKey": "card",
          "evidence": "Visa: usas 80 % de $ 5.000.000",
          "href": "/dashboard/personal/debts",
          "linkLabel": "Ir a Deudas",
          "rule": "high_utilization",
          "severity": "medium",
          "title": "Uso alto de la tarjeta Visa",
        },
        {
          "amount": 1171794.871794872,
          "entityKey": "laptop",
          "evidence": "Portátil: llevas $ 1.700.000; a hoy deberías llevar $ 2.871.795",
          "href": "/dashboard/personal/goals",
          "linkLabel": "Ir a Metas",
          "rule": "goal_at_risk",
          "severity": "medium",
          "title": "La meta Portátil va atrasada",
        },
        {
          "amount": 400000,
          "entityKey": "food",
          "evidence": "Mercado: $ 1.200.000 en mayo vs. $ 800.000 de promedio (+50 %)",
          "href": "/dashboard/personal/transactions?month=2026-05&type=expense&category=food",
          "linkLabel": "Ir a Movimientos",
          "rule": "category_growth",
          "severity": "medium",
          "title": "Mercado subió más de lo usual",
        },
        {
          "amount": 330000,
          "entityKey": "workspace",
          "evidence": "4 categorías con salidas este mes no tienen presupuesto: Mascotas, Salidas, Regalos…",
          "href": "/dashboard/personal/budgets",
          "linkLabel": "Ir a Presupuestos",
          "rule": "unbudgeted_spending",
          "severity": "low",
          "title": "Hay salidas sin presupuesto",
        },
        {
          "amount": 83138.91,
          "entityKey": "card",
          "evidence": "Visa tiene la tasa más alta (2,1 % mensual). Abona extra ahí primero",
          "href": "/dashboard/personal/debts",
          "linkLabel": "Ir a Deudas",
          "rule": "highest_rate_first",
          "severity": "low",
          "title": "Abona primero a la deuda más cara",
        },
        {
          "amount": 0,
          "entityKey": "workspace",
          "evidence": "Registraste movimientos en 4 de 12 semanas",
          "href": "/dashboard/personal/transactions",
          "linkLabel": "Ir a Movimientos",
          "rule": "irregular_records",
          "severity": "low",
          "title": "Registra tus movimientos con más frecuencia",
        },
      ]
    `)
  })

  it("no recomienda nada con un mes sano", () => {
    expect(
      buildRecommendations({
        score: {
          ...SCORE,
          months: SCORE.months.map((row) => ({
            ...row,
            expense: row.income * 0.5,
            closingBalance: 30_000_000
          })),
          activeWeeks: new Set(isoWeeks("2026-03-30", "2026-06-15")),
          debts: [],
          goals: []
        },
        lastClosedCategories: [],
        baseCategories: [],
        budgets: [budgetFixture("food", "Mercado", 500_000, 100_000)],
        upcomingPayments: [],
        accounts: []
      })
    ).toEqual([])
  })
})

describe("splitDismissed", () => {
  it("separa las ocultas por regla y entidad", () => {
    const all = buildRecommendations(INPUTS)
    const { active, hidden } = splitDismissed(all, [
      { rule: "deficit", entityKey: "2026-05" },
      { rule: "budget_exceeded", entityKey: "transport" }
    ])

    expect(hidden.map((row) => row.rule)).toEqual(["deficit"])
    expect(active).toHaveLength(all.length - 1)
  })
})
