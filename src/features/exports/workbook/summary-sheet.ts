import type { Workbook, Worksheet } from "exceljs"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { monthLabel } from "../range"
import type { ExportRange } from "../types"
import type { MonthSummaryCells } from "./personal-month-sheet"
import { FIRST_SECTION_ROW, writeSection, writeSheetHeader } from "./section"
import { finishSheet, workbookPalette } from "./theme"

export const SUMMARY_SHEET = "Resumen"

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole)

const round = (value: number) => Math.round(value * 100) / 100

/** Referencia a una celda de otra hoja: 'Octubre 2026'!B7 */
function ref(sheetName: string, cell: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${cell}`
}

const GENERATED_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
})

/** "6 nov 2026" desde YYYY-MM-DD */
function formatGenerated(today: string) {
  const [year, month, day] = today.split("-").map(Number)
  return GENERATED_FORMAT.format(new Date(Date.UTC(year, month - 1, day)))
    .replace(/\./g, "")
    .replace(/ de /g, " ")
}

/** "Octubre 2026", "2026" (enero a diciembre) o "Enero 2026 – Octubre 2026" */
export function periodLabel(range: Pick<ExportRange, "from" | "to">) {
  if (range.from === range.to) return monthLabel(range.from)

  const year = range.from.slice(0, 4)
  if (range.from === `${year}-01` && range.to === `${year}-12`) return year

  return `${monthLabel(range.from)} – ${monthLabel(range.to)}`
}

const LABELS: Record<
  WorkspaceType,
  { in: string; out: string; net: string; rate: string }
> = {
  personal: {
    in: "Ingresos",
    out: "Gastos",
    net: "Balance",
    rate: "Tasa de ahorro"
  },
  business: {
    in: "Ventas",
    out: "Costos y gastos",
    net: "Utilidad",
    rate: "Margen"
  }
}

/**
 * Hoja Resumen, primera del libro. Se crea antes que las de mes (para quedar
 * primera) y se llena con `fillSummarySheet` cuando esas ya existen.
 */
export function addSummarySheet(workbook: Workbook) {
  return workbook.addWorksheet(SUMMARY_SHEET)
}

/**
 * Tabla mes a mes con fórmulas a la hoja de cada mes. Totales: Ingresos,
 * Gastos y Balance suman; la tasa es la del total; el saldo es el del último
 * mes.
 */
export function fillSummarySheet(
  workbook: Workbook,
  sheet: Worksheet,
  options: {
    type: WorkspaceType
    workspaceName: string
    range: ExportRange
    months: MonthSummaryCells[]
    today: string
  }
) {
  const { type, range, months, today } = options
  const labels = LABELS[type]
  const title =
    type === "personal"
      ? "Tesoro · Personal"
      : `Tesoro · ${options.workspaceName}`

  const palette = workbookPalette(type)
  writeSheetHeader(workbook, sheet, palette, {
    title,
    subtitle: `${periodLabel(range)} · Generado el ${formatGenerated(today)}`,
    width: 6
  })

  type Row = MonthSummaryCells
  const totals = {
    in: round(months.reduce((sum, m) => sum + m.values.primaryIn, 0)),
    out: round(months.reduce((sum, m) => sum + m.values.primaryOut, 0)),
    net: round(months.reduce((sum, m) => sum + m.values.net, 0))
  }

  writeSection(sheet, palette, {
    startRow: FIRST_SECTION_ROW,
    title: "Mes a mes",
    columns: [
      {
        header: "Mes",
        key: "month",
        kind: "text",
        value: (row: Row) => row.sheetName
      },
      {
        header: labels.in,
        key: "in",
        kind: "money",
        value: (row: Row) => row.values.primaryIn,
        formula: (_r, _col, row) => ref(row.sheetName, row.cells.primaryIn),
        tone: () => "income"
      },
      {
        header: labels.out,
        key: "out",
        kind: "money",
        value: (row: Row) => row.values.primaryOut,
        formula: (_r, _col, row) => ref(row.sheetName, row.cells.primaryOut),
        tone: () => "expense"
      },
      {
        header: labels.net,
        key: "net",
        kind: "money",
        value: (row: Row) => row.values.net,
        formula: (_r, _col, row) => ref(row.sheetName, row.cells.net)
      },
      {
        header: labels.rate,
        key: "rate",
        kind: "percent",
        value: (row: Row) => row.values.rate,
        formula: (_r, _col, row) => ref(row.sheetName, row.cells.rate)
      },
      {
        header: "Saldo en cuentas al cierre",
        key: "closing",
        kind: "money",
        value: (row: Row) => row.values.closingBalance,
        formula: (_r, _col, row) => ref(row.sheetName, row.cells.closingBalance)
      }
    ],
    rows: months,
    emptyText: "Sin meses en el periodo",
    total: {
      label: "Total",
      cells: {
        in: "sum",
        out: "sum",
        net: "sum",
        rate: (ranges) => {
          const income = ranges.totalCell("in")
          const net = ranges.totalCell("net")
          return {
            formula: `IF(${income}=0,0,${net}/${income})`,
            result: ratio(totals.net, totals.in)
          }
        },
        closing: (ranges) => ({
          formula: `${ranges.columnLetters.closing}${ranges.lastRow}`,
          result: months.at(-1)?.values.closingBalance ?? 0
        })
      }
    }
  })

  finishSheet(sheet)
}
