import type { Content } from "pdfmake/interfaces"
import { monthTitle } from "../../range"
import type { PersonalMonthData } from "../../types"
import type { AmountTone } from "../../workbook/theme"
import type { PdfContext } from "../types"
import { movementsTable } from "./movements-table"
import { type PdfColumn, pdfTable } from "./table"

// Detalle de un mes de Personal (SPEC 33): mismas secciones, columnas,
// reglas de omisión y textos vacíos que su hoja del Excel (SPEC 32). Las
// secciones opcionales solo aparecen con filas; Resumen del mes, Saldos por
// cuenta y Movimientos siempre.

export const EMPTY_MONTH = "Sin movimientos este mes"

const round = (value: number) => Math.round(value * 100) / 100

export const ratio = (part: number, whole: number) =>
  whole === 0 ? 0 : part / whole

export const sumOf = (values: number[]) =>
  round(values.reduce((total, value) => total + value, 0))

export interface SummaryRow {
  label: string
  value: number
  kind?: "money" | "percent"
  tone?: AmountTone
}

/** Resumen del mes: Concepto | Valor; común a Personal y Empresa */
export function monthSummaryTable(ctx: PdfContext, rows: SummaryRow[]) {
  return pdfTable(ctx, {
    title: "Resumen del mes",
    columns: [
      { header: "Concepto", kind: "text", value: (row) => row.label },
      {
        header: "Valor",
        kind: "money",
        kindOf: (row) => row.kind ?? "money",
        value: (row) => row.value,
        tone: (row) => row.tone ?? null
      }
    ],
    rows
  })
}

/** Saldos por cuenta, con totales; común a Personal y Empresa */
export function accountsTable(
  ctx: PdfContext,
  accounts: PersonalMonthData["accounts"]
) {
  return pdfTable(ctx, {
    title: "Saldos por cuenta",
    columns: [
      { header: "Cuenta", kind: "text", value: (row) => row.name },
      { header: "Saldo al inicio", kind: "money", value: (row) => row.opening },
      { header: "Entradas", kind: "money", value: (row) => row.inflow },
      { header: "Salidas", kind: "money", value: (row) => row.outflow },
      { header: "Saldo al cierre", kind: "money", value: (row) => row.closing }
    ],
    rows: accounts,
    emptyText: EMPTY_MONTH,
    total: {
      label: "Total",
      values: [
        null,
        sumOf(accounts.map((row) => row.opening)),
        sumOf(accounts.map((row) => row.inflow)),
        sumOf(accounts.map((row) => row.outflow)),
        sumOf(accounts.map((row) => row.closing))
      ]
    }
  })
}

/** Título del mes; cada mes empieza en página nueva */
export function monthHeading(ctx: PdfContext, month: string): Content {
  return {
    text: monthTitle(month, ctx.today),
    style: "pageTitle",
    pageBreak: "before"
  }
}

type RecurringIncome = PersonalMonthData["recurringIncomes"][number]
type RecurringExpense = PersonalMonthData["recurringExpenses"][number]
type Budget = PersonalMonthData["budgets"][number]
type Goal = PersonalMonthData["goals"][number]
type Debt = PersonalMonthData["debts"][number]
type Receivable = PersonalMonthData["receivables"][number]

const RECURRING_INCOME_COLUMNS: PdfColumn<RecurringIncome>[] = [
  { header: "Nombre", kind: "text", value: (row) => row.name },
  { header: "Fecha esperada", kind: "date", value: (row) => row.dueOn },
  { header: "Categoría", kind: "text", value: (row) => row.category },
  { header: "Cuenta", kind: "text", value: (row) => row.account },
  { header: "Esperado", kind: "money", value: (row) => row.expected },
  { header: "Recibido", kind: "money", value: (row) => row.received },
  { header: "Estado", kind: "text", value: (row) => row.status }
]

const RECURRING_EXPENSE_COLUMNS: PdfColumn<RecurringExpense>[] = [
  { header: "Nombre", kind: "text", value: (row) => row.name },
  { header: "Fecha de pago", kind: "date", value: (row) => row.dueOn },
  { header: "Categoría", kind: "text", value: (row) => row.category },
  { header: "Monto", kind: "money", value: (row) => row.amount },
  { header: "Pagado", kind: "money", value: (row) => row.paid },
  { header: "Estado", kind: "text", value: (row) => row.status }
]

const BUDGET_COLUMNS: PdfColumn<Budget>[] = [
  { header: "Categoría", kind: "text", value: (row) => row.category },
  { header: "Límite", kind: "money", value: (row) => row.limit },
  { header: "Gastado", kind: "money", value: (row) => row.spent },
  {
    header: "Restante",
    kind: "money",
    value: (row) => round(row.limit - row.spent)
  },
  {
    header: "% usado",
    kind: "percent",
    value: (row) => ratio(row.spent, row.limit)
  }
]

const GOAL_COLUMNS: PdfColumn<Goal>[] = [
  { header: "Meta", kind: "text", value: (row) => row.name },
  {
    header: "Aportado en el mes",
    kind: "money",
    value: (row) => row.contributed
  },
  {
    header: "Ahorrado al cierre",
    kind: "money",
    value: (row) => row.savedAtClose
  },
  { header: "Objetivo", kind: "money", value: (row) => row.target },
  {
    header: "% logrado",
    kind: "percent",
    value: (row) => ratio(row.savedAtClose, row.target)
  }
]

const DEBT_COLUMNS: PdfColumn<Debt>[] = [
  { header: "Nombre", kind: "text", value: (row) => row.name },
  { header: "Tipo", kind: "text", value: (row) => row.kind },
  { header: "Pagos del mes", kind: "money", value: (row) => row.payments },
  { header: "Cargos del mes", kind: "money", value: (row) => row.charges },
  {
    header: "Saldo al cierre",
    kind: "money",
    value: (row) => row.balanceAtClose
  }
]

const RECEIVABLE_COLUMNS: PdfColumn<Receivable>[] = [
  { header: "Nombre", kind: "text", value: (row) => row.name },
  {
    header: "Esperado en el mes",
    kind: "money",
    value: (row) => row.expected
  },
  {
    header: "Cobrado en el mes",
    kind: "money",
    value: (row) => row.collected
  },
  {
    header: "Pendiente al cierre",
    kind: "money",
    value: (row) => row.pendingAtClose
  },
  { header: "Estado", kind: "text", value: (row) => row.status }
]

export function personalMonthSection(
  ctx: PdfContext,
  data: PersonalMonthData
): Content[] {
  const { income, expense, openingBalance, closingBalance } = data.summary
  const balance = round(income - expense)

  const content: Content[] = [
    monthHeading(ctx, data.month),
    monthSummaryTable(ctx, [
      { label: "Ingresos", value: income, tone: "income" },
      { label: "Gastos", value: expense, tone: "expense" },
      { label: "Balance", value: balance },
      {
        label: "Tasa de ahorro",
        value: ratio(balance, income),
        kind: "percent"
      },
      { label: "Saldo en cuentas al inicio", value: openingBalance },
      { label: "Saldo en cuentas al cierre", value: closingBalance }
    ]),
    accountsTable(ctx, data.accounts)
  ]

  if (data.recurringIncomes.length > 0) {
    const rows = data.recurringIncomes
    content.push(
      pdfTable(ctx, {
        title: "Ingresos fijos",
        columns: RECURRING_INCOME_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            null,
            null,
            null,
            sumOf(rows.map((row) => row.expected)),
            sumOf(rows.map((row) => row.received)),
            null
          ]
        }
      })
    )
  }

  if (data.recurringExpenses.length > 0) {
    const rows = data.recurringExpenses
    content.push(
      pdfTable(ctx, {
        title: "Gastos fijos",
        columns: RECURRING_EXPENSE_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            null,
            null,
            sumOf(rows.map((row) => row.amount)),
            sumOf(rows.map((row) => row.paid)),
            null
          ]
        }
      })
    )
  }

  if (data.budgets.length > 0) {
    const rows = data.budgets
    const limit = sumOf(rows.map((row) => row.limit))
    const spent = sumOf(rows.map((row) => row.spent))
    content.push(
      pdfTable(ctx, {
        title: "Presupuestos",
        columns: BUDGET_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            limit,
            spent,
            round(limit - spent),
            ratio(spent, limit)
          ]
        }
      })
    )
  }

  if (data.goals.length > 0) {
    const rows = data.goals
    const saved = sumOf(rows.map((row) => row.savedAtClose))
    const target = sumOf(rows.map((row) => row.target))
    content.push(
      pdfTable(ctx, {
        title: "Metas",
        columns: GOAL_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            sumOf(rows.map((row) => row.contributed)),
            saved,
            target,
            ratio(saved, target)
          ]
        }
      })
    )
  }

  if (data.debts.length > 0) {
    const rows = data.debts
    content.push(
      pdfTable(ctx, {
        title: "Deudas y tarjetas",
        columns: DEBT_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            null,
            sumOf(rows.map((row) => row.payments)),
            sumOf(rows.map((row) => row.charges)),
            sumOf(rows.map((row) => row.balanceAtClose))
          ]
        }
      })
    )
  }

  if (data.receivables.length > 0) {
    const rows = data.receivables
    content.push(
      pdfTable(ctx, {
        title: "Me deben",
        columns: RECEIVABLE_COLUMNS,
        rows,
        total: {
          label: "Total",
          values: [
            null,
            sumOf(rows.map((row) => row.expected)),
            sumOf(rows.map((row) => row.collected)),
            sumOf(rows.map((row) => row.pendingAtClose)),
            null
          ]
        }
      })
    )
  }

  content.push(movementsTable(ctx, data.movements, { emptyText: EMPTY_MONTH }))

  return content
}
