// Tipos mínimos de la clase interna de documento de pdfmake 0.3 (subclase de
// PDFDocument de PDFKit), que solo usa `fonts.ts`. @types/pdfmake no la
// declara.
declare module "pdfmake/js/PDFDocument" {
  interface VirtualFs {
    existsSync(name: string): boolean
    readFileSync(name: string): Buffer
  }

  export default class PdfmakeDocument {
    virtualfs: VirtualFs | null
    _registeredFonts: Record<string, unknown>
    registerFont(name: string, src: Buffer): this
    font(src: unknown, ...rest: unknown[]): this
  }
}
