import type { Content } from "pdfmake/interfaces"
import { movementTone } from "../../columns"
import type { BusinessMonthData, ExportMovementRow } from "../../types"
import type { AmountTone } from "../../workbook/theme"
import type { PdfContext } from "../types"
import { PORTRAIT_MOVEMENT_COLUMNS, isLandscape } from "./movements-table"
import {
  EMPTY_MONTH,
  accountsTable,
  monthHeading,
  monthSummaryTable,
  ratio,
  sumOf
} from "./personal-month"
import { type PdfColumn, pdfTable } from "./table"

// Detalle de un mes de Empresa (SPEC 33): mismas secciones, columnas,
// reglas de omisión y textos vacíos que su hoja del Excel (SPEC 32). No hay
// tabla de Movimientos: Ventas y Costos y gastos van por separado y
// Traspasos solo si hubo.

type Row = ExportMovementRow

/** Ventas y Costos y gastos en horizontal: las 9 columnas del Excel */
const OPERATION_COLUMNS: PdfColumn<Row>[] = [
  { header: "Fecha", kind: "date", value: (row) => row.date },
  { header: "Hora", kind: "time", value: (row) => row.time },
  { header: "Descripción", kind: "text", value: (row) => row.description },
  { header: "Categoría", kind: "text", value: (row) => row.category },
  { header: "Contraparte", kind: "text", value: (row) => row.counterparty },
  { header: "Factura", kind: "text", value: (row) => row.invoiceRef },
  { header: "Cuenta", kind: "text", value: (row) => row.account },
  { header: "Nota", kind: "text", value: (row) => row.note },
  {
    header: "Monto",
    kind: "money",
    value: (row) => row.amount,
    tone: movementTone
  }
]

/** Traspasos: las 6 columnas del Excel, en ambas orientaciones */
const TRANSFER_COLUMNS: PdfColumn<Row>[] = [
  { header: "Fecha", kind: "date", value: (row) => row.date },
  { header: "Hora", kind: "time", value: (row) => row.time },
  { header: "Origen", kind: "text", value: (row) => row.account },
  { header: "Destino", kind: "text", value: (row) => row.destination },
  { header: "Nota", kind: "text", value: (row) => row.note },
  {
    header: "Monto",
    kind: "money",
    value: (row) => row.amount,
    tone: movementTone
  }
]

type CategoryTotal = BusinessMonthData["costsByCategory"][number]

/** Fila de total con la suma de Monto en la última columna */
function amountTotal(columns: PdfColumn<Row>[], rows: Row[], tone: AmountTone) {
  const values: (number | null)[] = columns.map(() => null)
  const tones: (AmountTone | null)[] = columns.map(() => null)
  values[columns.length - 1] = sumOf(rows.map((row) => row.amount))
  tones[columns.length - 1] = tone
  return { label: "Total", values, tones }
}

function operationsTable(
  ctx: PdfContext,
  title: string,
  rows: Row[],
  tone: AmountTone
) {
  const columns = isLandscape(ctx)
    ? OPERATION_COLUMNS
    : PORTRAIT_MOVEMENT_COLUMNS

  return pdfTable(ctx, {
    title,
    columns,
    rows,
    emptyText: EMPTY_MONTH,
    compact: true,
    total: amountTotal(columns, rows, tone)
  })
}

export function businessMonthSection(
  ctx: PdfContext,
  data: BusinessMonthData
): Content[] {
  const { sales, costs, openingBalance, closingBalance } = data.summary
  const profit = Math.round((sales - costs) * 100) / 100

  const content: Content[] = [
    monthHeading(ctx, data.month),
    monthSummaryTable(ctx, [
      { label: "Ventas", value: sales, tone: "income" },
      { label: "Costos y gastos", value: costs, tone: "expense" },
      { label: "Utilidad", value: profit },
      { label: "Margen", value: ratio(profit, sales), kind: "percent" },
      { label: "Saldo en cuentas al inicio", value: openingBalance },
      { label: "Saldo en cuentas al cierre", value: closingBalance }
    ]),
    accountsTable(ctx, data.accounts),
    pdfTable<CategoryTotal>(ctx, {
      title: "Costos por categoría",
      columns: [
        { header: "Categoría", kind: "text", value: (row) => row.category },
        { header: "Total", kind: "money", value: (row) => row.total },
        {
          header: "% del total",
          kind: "percent",
          value: (row) => ratio(row.total, costs)
        }
      ],
      rows: data.costsByCategory,
      emptyText: EMPTY_MONTH,
      total: {
        label: "Total",
        values: [
          null,
          sumOf(data.costsByCategory.map((row) => row.total)),
          costs === 0 ? 0 : 1
        ]
      }
    }),
    operationsTable(ctx, "Ventas", data.sales, "income"),
    operationsTable(ctx, "Costos y gastos", data.costs, "expense")
  ]

  if (data.transfers.length > 0) {
    content.push(
      pdfTable(ctx, {
        title: "Traspasos",
        columns: TRANSFER_COLUMNS,
        rows: data.transfers,
        compact: true,
        total: amountTotal(TRANSFER_COLUMNS, data.transfers, "transfer")
      })
    )
  }

  return content
}
