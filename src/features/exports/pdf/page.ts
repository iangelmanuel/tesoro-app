import type {
  Margins,
  PageOrientation,
  PredefinedPageSize
} from "pdfmake/interfaces"
import type { PdfOptions } from "../types"

// Tamaño, orientación y márgenes de la página (SPEC 33). Las gráficas y las
// tablas toman `contentWidth`, así se adaptan a tamaño y orientación.

/** Ancho y alto en vertical, en puntos */
const SIZES: Record<
  PdfOptions["size"],
  { name: PredefinedPageSize; width: number; height: number }
> = {
  a4: { name: "A4", width: 595.28, height: 841.89 },
  letter: { name: "LETTER", width: 612, height: 792 }
}

export const MARGIN_X = 40
/** Arriba va el encabezado */
export const MARGIN_TOP = 72
/** Abajo va el pie */
export const MARGIN_BOTTOM = 56

export interface PageSetup {
  pageSize: PredefinedPageSize
  pageOrientation: PageOrientation
  pageMargins: Margins
  /** Ancho de la página ya orientada */
  width: number
  /** Alto de la página ya orientada */
  height: number
  /** Ancho útil entre márgenes */
  contentWidth: number
  /** Alto útil entre márgenes */
  contentHeight: number
}

export function pageSetup(options: Pick<PdfOptions, "size" | "orientation">) {
  const size = SIZES[options.size]
  const landscape = options.orientation === "landscape"
  const width = landscape ? size.height : size.width
  const height = landscape ? size.width : size.height

  return {
    pageSize: size.name,
    pageOrientation: options.orientation,
    pageMargins: [MARGIN_X, MARGIN_TOP, MARGIN_X, MARGIN_BOTTOM],
    width,
    height,
    contentWidth: width - MARGIN_X * 2,
    contentHeight: height - MARGIN_TOP - MARGIN_BOTTOM
  } satisfies PageSetup
}
