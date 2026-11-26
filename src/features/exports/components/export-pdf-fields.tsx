import type { PdfOptions } from "../types"
import { OptionTabs, PeriodSelect } from "./export-option-fields"

const PDF_SIZE_LABELS: Record<PdfOptions["size"], string> = {
  a4: "A4",
  letter: "Carta"
}

const PDF_THEME_HINTS: Record<PdfOptions["theme"], string> = {
  color: "Bandas y montos con los colores de tu espacio.",
  ink: "Sin rellenos de color: ideal para imprimir en blanco y negro."
}

interface ExportPdfFieldsProps {
  pdfOptions: PdfOptions
  onChange: (options: PdfOptions) => void
}

/** Tamaño, orientación y tema del PDF (SPEC 33) */
export function ExportPdfFields({
  pdfOptions,
  onChange
}: ExportPdfFieldsProps) {
  return (
    <>
      <PeriodSelect
        label="Tamaño"
        help="export.size"
        value={pdfOptions.size}
        onChange={(value) =>
          onChange({
            ...pdfOptions,
            size: value as PdfOptions["size"]
          })
        }
        options={Object.entries(PDF_SIZE_LABELS).map(([id, label]) => ({
          id,
          label
        }))}
      />
      <OptionTabs
        label="Orientación"
        help="export.orientation"
        value={pdfOptions.orientation}
        onChange={(value) =>
          onChange({
            ...pdfOptions,
            orientation: value as PdfOptions["orientation"]
          })
        }
        options={[
          { id: "portrait", label: "Vertical" },
          { id: "landscape", label: "Horizontal" }
        ]}
      />
      <OptionTabs
        label="Tema"
        help="export.inkSaver"
        value={pdfOptions.theme}
        onChange={(value) =>
          onChange({
            ...pdfOptions,
            theme: value as PdfOptions["theme"]
          })
        }
        options={[
          { id: "color", label: "Color" },
          { id: "ink", label: "Para imprimir" }
        ]}
        hint={PDF_THEME_HINTS[pdfOptions.theme]}
      />
    </>
  )
}
