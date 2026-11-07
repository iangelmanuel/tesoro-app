import pdfmake from "pdfmake"
import {
  INTER_BOLD,
  INTER_ITALIC,
  INTER_REGULAR,
  INTER_SEMIBOLD
} from "./fonts-data"

// Registra Inter en pdfmake (SPEC 33). Las fuentes viven en memoria (sistema
// de archivos virtual de pdfmake), así que el PDF no lee archivos del disco
// ni descarga nada: ambas políticas de acceso niegan todo.
//
// pdfmake solo distingue normal, bold, italics y bolditalics. SemiBold es
// una familia aparte: los estilos que lo usan fijan `font: FONT_SEMIBOLD`.

export const FONT = "Inter"
export const FONT_SEMIBOLD = "InterSemiBold"

const FILES = {
  regular: ["Inter-Regular.ttf", INTER_REGULAR],
  semibold: ["Inter-SemiBold.ttf", INTER_SEMIBOLD],
  bold: ["Inter-Bold.ttf", INTER_BOLD],
  italic: ["Inter-Italic.ttf", INTER_ITALIC]
} as const

// `virtualfs` existe en la API de Node de pdfmake 0.3, pero sus tipos no lo
// declaran
interface VirtualFs {
  writeFileSync(name: string, data: Buffer): void
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
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.setLocalAccessPolicy(() => false)

  registered = true
  return pdfmake
}
