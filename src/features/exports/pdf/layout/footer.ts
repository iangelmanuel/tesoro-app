import type { DynamicContent } from "pdfmake/interfaces"
import { MARGIN_X } from "../page"
import type { PdfContext } from "../types"

const TOP = 24

// Pie de todas las páginas menos la portada. La portada cuenta como página 1
export function pdfFooter(ctx: PdfContext): DynamicContent {
  return (currentPage, pageCount) => {
    if (currentPage === 1) return null

    return {
      margin: [MARGIN_X, TOP, MARGIN_X, 0],
      columns: [
        { text: `Generado el ${ctx.generated}`, style: "footerText" },
        {
          text: `Página ${currentPage} de ${pageCount}`,
          style: "footerText",
          alignment: "right"
        }
      ]
    }
  }
}
