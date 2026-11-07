import type { Content } from "pdfmake/interfaces"
import { gaugeChart } from "../charts/gauge"
import { richText } from "../rich-text"
import type { PdfContext, PdfScore } from "../types"
import { pdfTable } from "./table"

// Score y recomendaciones (SPEC 33): el score actual al día de generación
// (no el histórico del periodo), con su banda, medidor, factores y las
// recomendaciones activas con el mismo texto que la pantalla. Sin datos
// suficientes, solo los motivos y ningún número.

const GAUGE = { width: 200, height: 118 }

type Factor = Extract<PdfScore, { status: "ok" }>["factors"][number]

function insufficient(ctx: PdfContext, reasons: string[]): Content {
  const { theme } = ctx
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                text: "Sin datos suficientes",
                style: "sectionTitle",
                margin: [0, 0, 0, 6]
              },
              {
                ul: reasons.map((reason) => ({ text: reason, style: "body" })),
                color: theme.muted
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
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 10,
      paddingBottom: () => 10
    }
  }
}

function recommendationsBlock(
  ctx: PdfContext,
  items: Extract<PdfScore, { status: "ok" }>["recommendations"]
): Content[] {
  const heading: Content = { text: "Recomendaciones", style: "sectionTitle" }

  if (items.length === 0) {
    return [heading, { text: "Todo en orden por ahora.", style: "empty" }]
  }

  return [
    heading,
    ...items.map((item): Content => ({
      stack: [
        // El título va como texto plano: puede traer nombres del usuario
        { text: item.title, bold: true, margin: [0, 0, 0, 2] },
        { stack: [richText(item.html, ctx.theme)], style: "body" }
      ],
      unbreakable: true,
      margin: [0, 0, 0, 6]
    }))
  ]
}

export function scoreSection(ctx: PdfContext, score: PdfScore): Content[] {
  const { theme } = ctx
  const title =
    ctx.type === "personal" ? "Salud financiera" : "Salud del negocio"

  const content: Content[] = [
    {
      text: "Score y recomendaciones",
      style: "pageTitle",
      pageBreak: "before"
    },
    {
      text: `Score al ${ctx.generated}`,
      style: "sectionTitle",
      margin: [0, 0, 0, 8]
    }
  ]

  if (score.status === "insufficient") {
    content.push(insufficient(ctx, score.reasons))
    return content
  }

  content.push(
    {
      columns: [
        {
          svg: gaugeChart(
            score.value,
            GAUGE,
            theme.chart,
            theme.filled ? theme.accent : theme.chart.text
          ),
          width: GAUGE.width,
          height: GAUGE.height
        },
        {
          width: "*",
          stack: [
            { text: title, style: "small" },
            {
              text: score.band,
              fontSize: 20,
              bold: true,
              color: theme.accentDark,
              margin: [0, 2, 0, 6]
            },
            {
              text: "Es el score del día de generación, no un promedio del periodo. Cada factor dice cuánto aporta; uno sin datos se excluye y los pesos de los demás se reescalan.",
              style: "small"
            }
          ],
          margin: [20, 24, 0, 0]
        }
      ],
      margin: [0, 0, 0, 16]
    },
    pdfTable<Factor>(ctx, {
      title: "Desglose",
      columns: [
        { header: "Factor", kind: "text", value: (row) => row.name },
        {
          header: "Peso",
          kind: "text",
          value: (row) => String(row.weight),
          width: 40
        },
        { header: "Dato", kind: "text", value: (row) => row.value, width: 70 },
        { header: "Estado", kind: "text", value: (row) => row.state }
      ],
      rows: score.factors,
      emptyText: "Sin factores"
    }),
    ...recommendationsBlock(ctx, score.recommendations)
  )

  return content
}
