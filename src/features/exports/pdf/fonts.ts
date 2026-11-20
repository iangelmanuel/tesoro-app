import pdfmake from "pdfmake"
import PdfmakeDocument from "pdfmake/js/PDFDocument"
import {
  FONT_BOLD,
  FONT_ITALIC,
  FONT_REGULAR,
  FONT_SEMIBOLD as FONT_SEMIBOLD_DATA
} from "./fonts-data"

// Registra la fuente de la UI, Atkinson Hyperlegible Next (OFL, SPEC 51),
// en pdfmake (SPEC 33). Las fuentes viven en memoria (sistema
// de archivos virtual de pdfmake), así que el PDF no lee archivos del disco
// ni descarga nada: ambas políticas de acceso niegan todo.
//
// pdfmake solo distingue normal, bold, italics y bolditalics. SemiBold es
// una familia aparte: los estilos que lo usan fijan `font: FONT_SEMIBOLD`.

export const FONT = "AtkinsonHyperlegibleNext"
export const FONT_SEMIBOLD = "AtkinsonHyperlegibleNextSemiBold"

const FILES = {
  regular: ["AtkinsonHyperlegibleNext-Regular.ttf", FONT_REGULAR],
  semibold: ["AtkinsonHyperlegibleNext-SemiBold.ttf", FONT_SEMIBOLD_DATA],
  bold: ["AtkinsonHyperlegibleNext-Bold.ttf", FONT_BOLD],
  italic: ["AtkinsonHyperlegibleNext-Italic.ttf", FONT_ITALIC]
} as const

// `virtualfs` existe en la API de Node de pdfmake 0.3, pero sus tipos no lo
// declaran
interface VirtualFs {
  writeFileSync(name: string, data: Buffer): void
}

/**
 * Las gráficas SVG (svg-to-pdfkit) piden la fuente a PDFKit por nombre
 * ("AtkinsonHyperlegibleNext-Regular.ttf") y PDFKit la buscaría en disco. Antes de eso, el
 * documento la registra con ese nombre desde el sistema de archivos virtual
 * de pdfmake. Solo cambia algo para nombres que existen en ese sistema.
 */
function resolveSvgFontsFromMemory() {
  const proto = PdfmakeDocument.prototype
  const font = proto.font

  proto.font = function (this: PdfmakeDocument, src, ...rest) {
    if (
      typeof src === "string" &&
      !this._registeredFonts[src] &&
      this.virtualfs?.existsSync(src)
    ) {
      this.registerFont(src, this.virtualfs.readFileSync(src))
    }
    return font.call(this, src, ...rest)
  }
}

let registered = false

/** Prepara pdfmake una sola vez por proceso y lo devuelve */
export function getPdfmake() {
  if (registered) return pdfmake

  const { virtualfs } = pdfmake as unknown as { virtualfs: VirtualFs }
  for (const [name, data] of Object.values(FILES)) {
    virtualfs.writeFileSync(name, Buffer.from(data, "base64"))
  }

  pdfmake.setFonts({
    [FONT]: {
      normal: FILES.regular[0],
      bold: FILES.bold[0],
      italics: FILES.italic[0],
      // Sin Bold Italic: el spec embebe solo cuatro pesos
      bolditalics: FILES.bold[0]
    },
    [FONT_SEMIBOLD]: {
      normal: FILES.semibold[0],
      bold: FILES.bold[0],
      italics: FILES.italic[0],
      bolditalics: FILES.bold[0]
    }
  })
  resolveSvgFontsFromMemory()
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.setLocalAccessPolicy(() => false)

  registered = true
  return pdfmake
}
