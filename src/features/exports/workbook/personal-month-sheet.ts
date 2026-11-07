import type { Workbook, Worksheet } from "exceljs"
import { monthLabel, monthTitle } from "../range"
import type { PersonalMonthData } from "../types"
import { movementSectionColumns } from "./movements-sheet"
import {
  FIRST_SECTION_ROW,
  type Formula,
  type SectionRanges,
  writeSection,
  writeSheetHeader
} from "./section"
import {
  COLORS,
  NUMBER_FORMATS,
  type WorkbookPalette,
  finishSheet,
  workbookPalette
} from "./theme"

const EMPTY_MONTH = "Sin movimientos este mes"

/** Ancho de la sección más ancha (Movimientos sin la columna Mes) */
const SHEET_WIDTH = 9

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole)

const round = (value: number) => Math.round(value * 100) / 100

/** Celdas del Resumen del mes que la hoja Resumen referencia */
export interface MonthSummaryCells {
  sheetName: string
  /** Celdas A1 dentro de la hoja del mes */
  cells: {
    primaryIn: string
    primaryOut: string
    net: string
    rate: string
    closingBalance: string
  }
  /** Valores, para el `result` de las fórmulas entre hojas */
  values: {
    primaryIn: number
    primaryOut: number
    net: number
    rate: number
    closingBalance: number
  }
}

interface SummaryRow {
  label: string
  value: number
}

/**
 * Resumen del mes: Concepto | Valor. Las celdas de Valor se reemplazan por
 * fórmulas cuando ya están escritas las secciones de las que dependen.
 */
export function writeMonthSummary(
  sheet: Worksheet,
  accent: WorkbookPalette,
  startRow: number,
  rows: SummaryRow[]
) {
  return writeSection(sheet, accent, {
    startRow,
    title: "Resumen del mes",
    columns: [
      { header: "Concepto", key: "label", kind: "text" },
      { header: "Valor", key: "value", kind: "money" }
    ],
    rows
  })
}

/** Escribe una fórmula con su valor en una celda */
export function setFormula(
  sheet: Worksheet,
  address: string,
  value: Formula,
  options: { percent?: boolean; color?: string } = {}
) {
  const cell = sheet.getCell(address)
  cell.value = value
  cell.numFmt = options.percent ? NUMBER_FORMATS.percent : NUMBER_FORMATS.money
  if (options.color) cell.font = { color: { argb: options.color } }
}

/** Saldos por cuenta, con totales; común a Personal y Empresa */
export function writeAccountsSection(
  sheet: Worksheet,
  accent: WorkbookPalette,
  startRow: number,
  accounts: PersonalMonthData["accounts"]
) {
  return writeSection(sheet, accent, {
    startRow,
    title: "Saldos por cuenta",
    columns: [
      { header: "Cuenta", key: "name", kind: "text" },
      { header: "Saldo al inicio", key: "opening", kind: "money" },
      { header: "Entradas", key: "inflow", kind: "money" },
      { header: "Salidas", key: "outflow", kind: "money" },
      { header: "Saldo al cierre", key: "closing", kind: "money" }
    ],
    rows: accounts,
    emptyText: EMPTY_MONTH,
    total: {
      label: "Total",
      cells: { opening: "sum", inflow: "sum", outflow: "sum", closing: "sum" }
    }
  })
}

/** "=SUMIFS(Monto, Tipo, kind)" sobre la sección de movimientos */
export function sumByKind(
  movements: SectionRanges<string>,
  kind: string,
  result: number
): Formula {
  return {
    formula: `SUMIFS(${movements.range("amount")},${movements.range("kind")},"${kind}")`,
    result
  }
}

export function addPersonalMonthSheet(
  workbook: Workbook,
  data: PersonalMonthData,
  today: string
): MonthSummaryCells {
  const accent = workbookPalette("personal")
  const sheetName = monthLabel(data.month)
  const sheet = workbook.addWorksheet(sheetName)

  writeSheetHeader(workbook, sheet, accent, {
    title: monthTitle(data.month, today),
    subtitle: "Tesoro · Personal",
    width: SHEET_WIDTH
  })

  const { income, expense, openingBalance, closingBalance } = data.summary
  const balance = round(income - expense)
  const rate = ratio(balance, income)

  // 1. Resumen del mes (las fórmulas van al final)
  const summary = writeMonthSummary(sheet, accent, FIRST_SECTION_ROW, [
    { label: "Ingresos", value: income },
    { label: "Gastos", value: expense },
    { label: "Balance", value: balance },
    { label: "Tasa de ahorro", value: rate },
    { label: "Saldo en cuentas al inicio", value: openingBalance },
    { label: "Saldo en cuentas al cierre", value: closingBalance }
  ])
  const valueCell = (index: number) =>
    `${summary.columnLetters.value}${summary.firstRow + index}`

  // 2. Saldos por cuenta
  const accounts = writeAccountsSection(
    sheet,
    accent,
    summary.nextRow,
    data.accounts
  )
  let row = accounts.nextRow

  // 3. Ingresos fijos
  if (data.recurringIncomes.length > 0) {
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Ingresos fijos",
      columns: [
        { header: "Nombre", key: "name", kind: "text" },
        { header: "Fecha esperada", key: "dueOn", kind: "date" },
        { header: "Categoría", key: "category", kind: "text" },
        { header: "Cuenta", key: "account", kind: "text" },
        { header: "Esperado", key: "expected", kind: "money" },
        { header: "Recibido", key: "received", kind: "money" },
        { header: "Estado", key: "status", kind: "text" }
      ],
      rows: data.recurringIncomes,
      total: { label: "Total", cells: { expected: "sum", received: "sum" } }
    }).nextRow
  }

  // 4. Gastos fijos
  if (data.recurringExpenses.length > 0) {
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Gastos fijos",
      columns: [
        { header: "Nombre", key: "name", kind: "text" },
        { header: "Fecha de pago", key: "dueOn", kind: "date" },
        { header: "Categoría", key: "category", kind: "text" },
        { header: "Monto", key: "amount", kind: "money" },
        { header: "Pagado", key: "paid", kind: "money" },
        { header: "Estado", key: "status", kind: "text" }
      ],
      rows: data.recurringExpenses,
      total: { label: "Total", cells: { amount: "sum", paid: "sum" } }
    }).nextRow
  }

  // 5. Presupuestos
  if (data.budgets.length > 0) {
    type Budget = PersonalMonthData["budgets"][number]
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Presupuestos",
      columns: [
        { header: "Categoría", key: "category", kind: "text" },
        { header: "Límite", key: "limit", kind: "money" },
        { header: "Gastado", key: "spent", kind: "money" },
        {
          header: "Restante",
          key: "remaining",
          kind: "money",
          value: (budget: Budget) => round(budget.limit - budget.spent),
          formula: (r, col) => `${col.limit}${r}-${col.spent}${r}`
        },
        {
          header: "% usado",
          key: "used",
          kind: "percent",
          value: (budget: Budget) => ratio(budget.spent, budget.limit),
          formula: (r, col) =>
            `IF(${col.limit}${r}=0,0,${col.spent}${r}/${col.limit}${r})`
        }
      ],
      rows: data.budgets,
      total: {
        label: "Total",
        cells: {
          limit: "sum",
          spent: "sum",
          remaining: "sum",
          used: (ranges) => {
            const limit = ranges.totalCell("limit")
            const spent = ranges.totalCell("spent")
            return {
              formula: `IF(${limit}=0,0,${spent}/${limit})`,
              result: ratio(
                sumOf(data.budgets.map((b) => b.spent)),
                sumOf(data.budgets.map((b) => b.limit))
              )
            }
          }
        }
      }
    }).nextRow
  }

  // 6. Metas
  if (data.goals.length > 0) {
    type Goal = PersonalMonthData["goals"][number]
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Metas",
      columns: [
        { header: "Meta", key: "name", kind: "text" },
        { header: "Aportado en el mes", key: "contributed", kind: "money" },
        { header: "Ahorrado al cierre", key: "savedAtClose", kind: "money" },
        { header: "Objetivo", key: "target", kind: "money" },
        {
          header: "% logrado",
          key: "progress",
          kind: "percent",
          value: (goal: Goal) => ratio(goal.savedAtClose, goal.target),
          formula: (r, col) =>
            `IF(${col.target}${r}=0,0,${col.savedAtClose}${r}/${col.target}${r})`
        }
      ],
      rows: data.goals,
      total: {
        label: "Total",
        cells: {
          contributed: "sum",
          savedAtClose: "sum",
          target: "sum",
          progress: (ranges) => {
            const target = ranges.totalCell("target")
            const saved = ranges.totalCell("savedAtClose")
            return {
              formula: `IF(${target}=0,0,${saved}/${target})`,
              result: ratio(
                sumOf(data.goals.map((g) => g.savedAtClose)),
                sumOf(data.goals.map((g) => g.target))
              )
            }
          }
        }
      }
    }).nextRow
  }

  // 7. Deudas y tarjetas
  if (data.debts.length > 0) {
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Deudas y tarjetas",
      columns: [
        { header: "Nombre", key: "name", kind: "text" },
        { header: "Tipo", key: "kind", kind: "text" },
        { header: "Pagos del mes", key: "payments", kind: "money" },
        { header: "Cargos del mes", key: "charges", kind: "money" },
        { header: "Saldo al cierre", key: "balanceAtClose", kind: "money" }
      ],
      rows: data.debts,
      total: {
        label: "Total",
        cells: { payments: "sum", charges: "sum", balanceAtClose: "sum" }
      }
    }).nextRow
  }

  // 8. Me deben
  if (data.receivables.length > 0) {
    row = writeSection(sheet, accent, {
      startRow: row,
      title: "Me deben",
      columns: [
        { header: "Nombre", key: "name", kind: "text" },
        { header: "Esperado en el mes", key: "expected", kind: "money" },
        { header: "Cobrado en el mes", key: "collected", kind: "money" },
        { header: "Pendiente al cierre", key: "pendingAtClose", kind: "money" },
        { header: "Estado", key: "status", kind: "text" }
      ],
      rows: data.receivables,
      total: {
        label: "Total",
        cells: { expected: "sum", collected: "sum", pendingAtClose: "sum" }
      }
    }).nextRow
  }

  // 9. Movimientos (con traspasos)
  const movements = writeSection(sheet, accent, {
    startRow: row,
    title: "Movimientos",
    columns: movementSectionColumns("personal", { withMonth: false }),
    rows: data.movements,
    emptyText: EMPTY_MONTH
  }) as SectionRanges<string>

  // Fórmulas del Resumen del mes. Los traspasos no suman a ingresos ni gastos.
  const [incomeCell, expenseCell, balanceCell, rateCell, openCell, closeCell] =
    [0, 1, 2, 3, 4, 5].map(valueCell)

  setFormula(sheet, incomeCell, sumByKind(movements, "Ingreso", income), {
    color: COLORS.income
  })
  setFormula(sheet, expenseCell, sumByKind(movements, "Gasto", expense), {
    color: COLORS.expense
  })
  setFormula(sheet, balanceCell, {
    formula: `${incomeCell}-${expenseCell}`,
    result: balance
  })
  setFormula(
    sheet,
    rateCell,
    {
      formula: `IF(${incomeCell}=0,0,${balanceCell}/${incomeCell})`,
      result: rate
    },
    { percent: true }
  )
  setFormula(sheet, openCell, {
    formula: accounts.totalCell("opening"),
    result: openingBalance
  })
  setFormula(sheet, closeCell, {
    formula: accounts.totalCell("closing"),
    result: closingBalance
  })

  finishSheet(sheet)

  return {
    sheetName,
    cells: {
      primaryIn: incomeCell,
      primaryOut: expenseCell,
      net: balanceCell,
      rate: rateCell,
      closingBalance: closeCell
    },
    values: {
      primaryIn: income,
      primaryOut: expense,
      net: balance,
      rate,
      closingBalance
    }
  }
}

function sumOf(values: number[]) {
  return round(values.reduce((a, b) => a + b, 0))
}
