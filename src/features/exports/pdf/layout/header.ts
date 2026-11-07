import type { DynamicContent } from "pdfmake/interfaces"
import { MARK_SVG } from "../brand-data"
import { MARGIN_X } from "../page"
import type { PdfContext } from "../types"

const TOP = 28
const LOGO_SIZE = 14

// Encabezado de todas las páginas menos la portada: logo y espacio a la
// izquierda, periodo a la derecha y una línea fina del color del espacio
export function pdfHeader(ctx: PdfContext): DynamicContent {
  const { theme, page } = ctx

  return (currentPage) => {
    if (currentPage === 1) return null

    return {
      margin: [MARGIN_X, TOP, MARGIN_X, 0],
      stack: [
        {
          columns: [
            { svg: MARK_SVG, width: LOGO_SIZE, height: LOGO_SIZE },
            {
              text: `Tesoro · ${ctx.workspaceName}`,
              style: "headerText",
              width: "*",
              margin: [6, 2, 0, 0]
            },
            {
              text: ctx.period,
              style: "headerMeta",
              width: "auto",
              alignment: "right",
              margin: [0, 2, 0, 0]
            }
          ]
        },
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: page.contentWidth,
              y2: 0,
              lineWidth: 0.75,
              lineColor: theme.accent
            }
          ],
          margin: [0, 8, 0, 0]
        }
      ]
    }
  }
}
