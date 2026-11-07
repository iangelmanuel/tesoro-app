import type { Content } from "pdfmake/interfaces"
import { MARK_SVG } from "../brand-data"
import type { PdfContext } from "../types"

const LOGO_SIZE = 72

// Portada: página propia, sin encabezado ni pie (lo deciden `layout/*`).
// El QR y la introducción llegan en el paso 6 del spec.
export function coverSection(ctx: PdfContext): Content {
  return {
    stack: [
      { svg: MARK_SVG, width: LOGO_SIZE, height: LOGO_SIZE },
      {
        text: "Reporte financiero",
        style: "coverTitle",
        margin: [0, 28, 0, 6]
      },
      { text: ctx.workspaceName, style: "coverSubtitle" },
      { text: ctx.period, style: "coverMeta", margin: [0, 18, 0, 2] },
      { text: `Generado el ${ctx.generated}`, style: "coverMeta" }
    ],
    margin: [0, ctx.page.contentHeight * 0.12, 0, 0]
  }
}
