import type { Content } from "pdfmake/interfaces"
import { PERCENT, formatPercentChange } from "@/features/reports/change"
import { percentChange, savingsRate } from "@/features/reports/metrics"
import { formatCurrency } from "@/libs/format"
import { monthLabel } from "../../range"
import type { PdfContext, PdfReportData } from "../types"
import { ratio, sumOf } from "./personal-month"
import { pdfTable } from "./table"

// Resumen del periodo (SPEC 33): KPIs con su variación contra el periodo
// anterior de igual largo (el mismo cálculo de Reportes) y la tabla mes a
// mes con las columnas y la fila de total de la hoja Resumen del Excel.

const LABELS = {
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
} as const

const POINTS = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero"
})

/** Fila de la tabla mes a mes */
interface MonthRow {
  month: string
  in: number
  out: number
  net: number
  rate: number
  closing: number
}

function monthRows(data: PdfReportData): MonthRow[] {
  const round = (value: number) => Math.round(value * 100) / 100

  if (data.export.type === "personal") {
    return data.export.months.map(({ month, summary }) => ({
      month,
      in: summary.income,
      out: summary.expense,
      net: round(summary.income - summary.expense),
      rate: ratio(summary.income - summary.expense, summary.income),
      closing: summary.closingBalance
    }))
  }

  return data.export.months.map(({ month, summary }) => ({
    month,
    in: summary.sales,
    out: summary.costs,
    net: round(summary.sales - summary.costs),
    rate: ratio(summary.sales - summary.costs, summary.sales),
    closing: summary.closingBalance
  }))
}

type Trend = "higher-is-better" | "lower-is-better"

interface Kpi {
  label: string
  value: string
  /** Color del valor (Balance o Utilidad negativos) */
  valueColor?: string
  change: string
  /** Variación redondeada a un decimal; null sin base para comparar */
  rounded: number | null
  trend: Trend
}

/** Tarjeta de KPI: etiqueta, valor y variación */
function kpiCard(ctx: PdfContext, kpi: Kpi, comparedWith: string): Content {
  const { theme } = ctx
  const isUp = kpi.rounded !== null && kpi.rounded > 0
  const isGood = isUp === (kpi.trend === "higher-is-better")
  const changeColor =
    kpi.rounded === null || kpi.rounded === 0
      ? theme.muted
      : isGood
        ? theme.tone.income
        : theme.tone.expense

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              { text: kpi.label, style: "small" },
              {
                text: kpi.value,
                fontSize: 15,
                bold: true,
                color: kpi.valueColor,
                margin: [0, 4, 0, 4],
                noWrap: true
              },
              {
                text: [
                  {
                    text: kpi.change.replace("-", "−"),
                    color: changeColor,
                    bold: true
                  },
                  { text: ` vs. ${comparedWith}`, color: theme.muted }
                ],
                fontSize: 7.5
              }
            ]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => (theme.filled ? 0 : theme.lineWidth),
      vLineWidth: () => (theme.filled ? 0 : theme.lineWidth),
      hLineColor: () => theme.line,
      vLineColor: () => theme.line,
      fillColor: () => (theme.filled ? theme.zebra : null),
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 8,
      paddingBottom: () => 8
    }
  }
}

function kpis(ctx: PdfContext, data: PdfReportData, rows: MonthRow[]): Kpi[] {
  const labels = LABELS[ctx.type]
  const current = {
    in: sumOf(rows.map((row) => row.in)),
    out: sumOf(rows.map((row) => row.out))
  }
  const previous = data.previousTotals
  const net = current.in - current.out
  const previousNet = previous.income - previous.expense

  const relative = (value: number, base: number) => {
    const change = percentChange(value, base)
    return change === null ? null : Math.round(change * 10) / 10
  }

  const inChange = relative(current.in, previous.income)
  const outChange = relative(current.out, previous.expense)
  const netChange = relative(net, previousNet)

  // La tasa varía en puntos (pp), como en Reportes: "+20 % de una tasa" confunde
  const rate = savingsRate(current.in, current.out)
  const previousRate = savingsRate(previous.income, previous.expense)
  const rateChange =
    rate === null || previousRate === null
      ? null
      : Math.round((rate - previousRate) * 10) / 10

  return [
    {
      label: labels.in,
      value: formatCurrency(current.in),
      change: formatPercentChange(inChange),
      rounded: inChange,
      trend: "higher-is-better"
    },
    {
      label: labels.out,
      value: formatCurrency(current.out),
      change: formatPercentChange(outChange),
      rounded: outChange,
      trend: "lower-is-better"
    },
    {
      label: labels.net,
      value: formatCurrency(net).replace("-", "−"),
      valueColor: net < 0 ? ctx.theme.tone.expense : undefined,
      change: formatPercentChange(netChange),
      rounded: netChange,
      trend: "higher-is-better"
    },
    {
      label: labels.rate,
      value: rate === null ? "—" : PERCENT.format(rate / 100),
      change: rateChange === null ? "—" : `${POINTS.format(rateChange)} pp`,
      rounded: rateChange,
      trend: "higher-is-better"
    }
  ]
}

/** "Septiembre 2026" o "Ene – Sep 2026": el periodo anterior, para el pie de las KPI */
function previousLabel(from: string, to: string) {
  if (from === to) return monthLabel(from)
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  const start = sameYear ? monthLabel(from).split(" ")[0] : monthLabel(from)
  return `${start} – ${monthLabel(to)}`
}

export function periodSummarySection(
  ctx: PdfContext,
  data: PdfReportData,
  previous: { from: string; to: string }
): Content[] {
  const labels = LABELS[ctx.type]
  const rows = monthRows(data)
  const comparedWith = previousLabel(previous.from, previous.to)
  const totalIn = sumOf(rows.map((row) => row.in))
  const totalNet = sumOf(rows.map((row) => row.net))

  return [
    {
      text: "Resumen del periodo",
      style: "pageTitle",
      pageBreak: "before"
    },
    {
      columns: kpis(ctx, data, rows).map((kpi) => ({
        width: "*",
        stack: [kpiCard(ctx, kpi, comparedWith)]
      })),
      columnGap: 10,
      margin: [0, 0, 0, 20]
    },
    pdfTable<MonthRow>(ctx, {
      title: "Mes a mes",
      columns: [
        { header: "Mes", kind: "text", value: (row) => monthLabel(row.month) },
        {
          header: labels.in,
          kind: "money",
          value: (row) => row.in,
          tone: () => "income"
        },
        {
          header: labels.out,
          kind: "money",
          value: (row) => row.out,
          tone: () => "expense"
        },
        { header: labels.net, kind: "money", value: (row) => row.net },
        { header: labels.rate, kind: "percent", value: (row) => row.rate },
        {
          header: "Saldo en cuentas al cierre",
          kind: "money",
          value: (row) => row.closing
        }
      ],
      rows,
      emptyText: "Sin meses en el periodo",
      total: {
        label: "Total",
        values: [
          null,
          totalIn,
          sumOf(rows.map((row) => row.out)),
          totalNet,
          ratio(totalNet, totalIn),
          rows.at(-1)?.closing ?? 0
        ],
        tones: [null, "income", "expense", null, null, null]
      }
    })
  ]
}
