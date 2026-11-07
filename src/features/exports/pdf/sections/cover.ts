import type { Content } from "pdfmake/interfaces"
import { MARK_SVG } from "../brand-data"
import { html, richText } from "../rich-text"
import type { PdfContext } from "../types"

const LOGO_SIZE = 72
const QR_SIZE = 96
/** Ancho máximo de la introducción, para líneas cómodas de leer */
const INTRO_MAX_WIDTH = 380

function intro(ctx: PdfContext) {
  if (ctx.type === "business") {
    return html`<p>
        Este reporte reúne la operación de
        <strong>${ctx.workspaceName}</strong> en el periodo: el
        <strong>resumen</strong> de ventas, costos y utilidad, las
        <strong>gráficas</strong> del periodo, el <strong>score</strong> del
        negocio con sus recomendaciones y el
        <strong>detalle de cada mes</strong>.
      </p>
      <p>
        Las cifras salen de los registros que hiciste en Tesoro y van en pesos
        colombianos.
      </p>`
  }

  return html`<p>
      Este reporte reúne tus finanzas personales del periodo: el
      <strong>resumen</strong> de ingresos, gastos y ahorro, las
      <strong>gráficas</strong> del periodo, tu
      <strong>score de salud financiera</strong> con sus recomendaciones y el
      <strong>detalle de cada mes</strong>.
    </p>
    <p>
      Las cifras salen de los registros que hiciste en Tesoro y van en pesos
      colombianos.
    </p>`
}

// Portada: página propia, sin encabezado ni pie (lo deciden `layout/*`).
// El QR lleva a Reportes del espacio con el mismo periodo; la página pide
// la sesión del dueño, así que el código no expone datos. En horizontal la
// identidad y los detalles van en dos columnas para caber en una página.
export function coverSection(ctx: PdfContext, reportsUrl: string): Content {
  const { theme, page } = ctx
  const landscape = page.width > page.height
  const detailsWidth = Math.min(
    landscape ? page.contentWidth / 2 : page.contentWidth,
    INTRO_MAX_WIDTH
  )

  const identity: Content[] = [
    { svg: MARK_SVG, width: LOGO_SIZE, height: LOGO_SIZE },
    {
      text: "Reporte financiero",
      style: "coverTitle",
      margin: [0, 28, 0, 6]
    },
    { text: ctx.workspaceName, style: "coverSubtitle" },
    { text: ctx.period, style: "coverMeta", margin: [0, 18, 0, 2] },
    { text: `Generado el ${ctx.generated}`, style: "coverMeta" }
  ]

  const details: Content[] = [
    { stack: [richText(intro(ctx), theme)], style: "body" },
    {
      columns: [
        {
          qr: reportsUrl,
          fit: QR_SIZE,
          foreground: theme.text,
          width: QR_SIZE
        },
        {
          width: "*",
          stack: [
            { text: "Abre este periodo en Tesoro", style: "sectionTitle" },
            {
              text: "Escanéalo para abrir este periodo en Tesoro. Necesitas iniciar sesión.",
              style: "small"
            }
          ],
          margin: [16, 14, 0, 0]
        }
      ],
      margin: [0, 28, 0, 0],
      unbreakable: true
    }
  ]

  const divider = (width: number, marginTop: number): Content => ({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: width,
        y2: 0,
        lineWidth: theme.lineWidth,
        lineColor: theme.line
      }
    ],
    margin: [0, marginTop, 0, 20]
  })

  if (landscape) {
    return {
      columns: [
        { width: "*", stack: identity },
        {
          width: detailsWidth,
          stack: [divider(detailsWidth, 0), ...details],
          margin: [0, LOGO_SIZE + 28, 0, 0]
        }
      ],
      columnGap: 40,
      margin: [0, page.contentHeight * 0.06, 0, 0]
    }
  }

  return {
    stack: [
      ...identity,
      divider(detailsWidth, 28),
      { columns: [{ width: detailsWidth, stack: details }] }
    ],
    margin: [0, page.contentHeight * 0.08, 0, 0]
  }
}
