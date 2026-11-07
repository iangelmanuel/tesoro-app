import type { Workbook, Worksheet } from "exceljs"
import { movementTone } from "../columns"
import { monthLabel, monthTitle } from "../range"
import type { BusinessMonthData, ExportMovementRow } from "../types"
import {
  type MonthSummaryCells,
  setFormula,
  writeAccountsSection,
  writeMonthSummary
} from "./personal-month-sheet"
import {
  FIRST_SECTION_ROW,
  type SectionColumn,
  writeSection,
  writeSheetHeader
} from "./section"
import {
  COLORS,
  type WorkbookPalette,
  finishSheet,
  workbookPalette
} from "./theme"

const EMPTY_MONTH = "Sin movimientos este mes"

/** Ancho de la sección más ancha (Ventas y Costos y gastos) */
const SHEET_WIDTH = 9

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole)

const round = (value: number) => Math.round(value * 100) / 100

type MovementKey = keyof ExportMovementRow & string

/** Ventas y Costos y gastos: mismas columnas */
const OPERATION_COLUMNS: SectionColumn<ExportMovementRow, MovementKey>[] = [
  { header: "Fecha", key: "date", kind: "date" },
  { header: "Hora", key: "time", kind: "time" },
  { header: "Descripción", key: "description", kind: "text" },
  { header: "Categoría", key: "category", kind: "text" },
  { header: "Contraparte", key: "counterparty", kind: "text" },
  { header: "Factura", key: "invoiceRef", kind: "text" },
  { header: "Cuenta", key: "account", kind: "text" },
  { header: "Nota", key: "note", kind: "text" },
  { header: "Monto", key: "amount", kind: "money", tone: movementTone }
]

const TRANSFER_COLUMNS: SectionColumn<ExportMovementRow, MovementKey>[] = [
  { header: "Fecha", key: "date", kind: "date" },
  { header: "Hora", key: "time", kind: "time" },
  { header: "Origen", key: "account", kind: "text" },
  { header: "Destino", key: "destination", kind: "text" },
  { header: "Nota", key: "note", kind: "text" },
  { header: "Monto", key: "amount", kind: "money", tone: movementTone }
]

function writeOperations(
  sheet: Worksheet,
  accent: WorkbookPalette,
  startRow: number,
  title: string,
  rows: ExportMovementRow[]
) {
  return writeSection(sheet, accent, {
    startRow,
    title,
    columns: OPERATION_COLUMNS,
    rows,
    emptyText: EMPTY_MONTH,
    total: { label: "Total", cells: { amount: "sum" } }
  })
}

export function addBusinessMonthSheet(
  workbook: Workbook,
  workspaceName: string,
  data: BusinessMonthData,
  today: string
): MonthSummaryCells {
  const accent = workbookPalette("business")
  const sheetName = monthLabel(data.month)
  const sheet = workbook.addWorksheet(sheetName)

  writeSheetHeader(workbook, sheet, accent, {
    title: monthTitle(data.month, today),
    subtitle: `Tesoro · ${workspaceName}`,
    width: SHEET_WIDTH
  })

  const { sales, costs, openingBalance, closingBalance } = data.summary
  const profit = round(sales - costs)
  const margin = ratio(profit, sales)

  // 1. Resumen del mes (las fórmulas van al final)
  const summary = writeMonthSummary(sheet, accent, FIRST_SECTION_ROW, [
    { label: "Ventas", value: sales },
    { label: "Costos y gastos", value: costs },
    { label: "Utilidad", value: profit },
    { label: "Margen", value: margin },
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

  // 3. Costos por categoría. El % apunta al total de la sección, que queda
  // justo debajo de la última fila.
  const categoriesStart = accounts.nextRow
  const categoriesTotalRow =
    categoriesStart + 2 + Math.max(data.costsByCategory.length, 1)
  type CategoryTotal = BusinessMonthData["costsByCategory"][number]
  const categories = writeSection(sheet, accent, {
    startRow: categoriesStart,
    title: "Costos por categoría",
    columns: [
      { header: "Categoría", key: "category", kind: "text" },
      { header: "Total", key: "total", kind: "money" },
      {
        header: "% del total",
        key: "share",
        kind: "percent",
        value: (row: CategoryTotal) => ratio(row.total, costs),
        formula: (r, col) =>
          `IF(${col.total}$${categoriesTotalRow}=0,0,${col.total}${r}/${col.total}$${categoriesTotalRow})`
      }
    ],
    rows: data.costsByCategory,
    emptyText: EMPTY_MONTH,
    total: {
      label: "Total",
      cells: {
        total: "sum",
        share: (ranges) => ({
          formula: `IF(${ranges.totalCell("total")}=0,0,1)`,
          result: costs === 0 ? 0 : 1
        })
      }
    }
  })

  // 4. Ventas y 5. Costos y gastos
  const salesSection = writeOperations(
    sheet,
    accent,
    categories.nextRow,
    "Ventas",
    data.sales
  )
  const costsSection = writeOperations(
    sheet,
    accent,
    salesSection.nextRow,
    "Costos y gastos",
    data.costs
  )

  // 6. Traspasos (solo si hubo)
  if (data.transfers.length > 0) {
    writeSection(sheet, accent, {
      startRow: costsSection.nextRow,
      title: "Traspasos",
      columns: TRANSFER_COLUMNS,
      rows: data.transfers,
      total: { label: "Total", cells: { amount: "sum" } }
    })
  }

  // Fórmulas del Resumen del mes. Los traspasos no son ventas ni costos.
  const [salesCell, costsCell, profitCell, marginCell, openCell, closeCell] = [
    0, 1, 2, 3, 4, 5
  ].map(valueCell)

  setFormula(
    sheet,
    salesCell,
    { formula: salesSection.totalCell("amount"), result: sales },
    { color: COLORS.income }
  )
  setFormula(
    sheet,
    costsCell,
    { formula: costsSection.totalCell("amount"), result: costs },
    { color: COLORS.expense }
  )
  setFormula(sheet, profitCell, {
    formula: `${salesCell}-${costsCell}`,
    result: profit
  })
  setFormula(
    sheet,
    marginCell,
    {
      formula: `IF(${salesCell}=0,0,${profitCell}/${salesCell})`,
      result: margin
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
      primaryIn: salesCell,
      primaryOut: costsCell,
      net: profitCell,
      rate: marginCell,
      closingBalance: closeCell
    },
    values: {
      primaryIn: sales,
      primaryOut: costs,
      net: profit,
      rate: margin,
      closingBalance
    }
  }
}
