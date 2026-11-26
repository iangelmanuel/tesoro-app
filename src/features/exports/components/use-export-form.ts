"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import { countMonths, listMonths, todayISO } from "@/libs/dates"
import { parseExportRange } from "../range"
import {
  DEFAULT_PDF_OPTIONS,
  type ExportFormat,
  MAX_EXPORT_MONTHS,
  MAX_PDF_MONTHS,
  type PdfOptions
} from "../types"
import {
  type ExportPeriod,
  changeSelectionPeriod,
  initialSelection,
  minMonth,
  quarterOf,
  selectionMonths
} from "./export-selection"

/** Nombre del archivo desde Content-Disposition */
function fileNameFrom(response: Response, fallback: string) {
  const header = response.headers.get("Content-Disposition") ?? ""
  return /filename="([^"]+)"/.exec(header)?.[1] ?? fallback
}

/** Estado del formulario de Exportar y la descarga del archivo */
export function useExportForm({
  workspaceId,
  historyStart,
  onDone
}: {
  workspaceId: string
  historyStart: string | null
  onDone: () => void
}) {
  const searchParams = useSearchParams()
  const today = todayISO()
  const current = today.slice(0, 7)

  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [pdfOptions, setPdfOptions] = useState<PdfOptions>(DEFAULT_PDF_OPTIONS)
  const [selection, setSelection] = useState(() =>
    initialSelection(new URLSearchParams(searchParams.toString()), current)
  )
  const [pending, setPending] = useState(false)

  const start = historyStart ?? current
  const historyMonths = countMonths(start, current)
  const isPdf = format === "pdf"
  // Con PDF el tope es de 12 meses; con Excel y CSV, de 36
  const maxMonths = isPdf ? MAX_PDF_MONTHS : MAX_EXPORT_MONTHS
  const allDisabled = historyStart === null || historyMonths > maxMonths

  // Opciones desde el primer mes con historial (o el prellenado, si es
  // anterior) hasta el actual, de la más reciente a la más antigua
  const firstOption = minMonth(
    start,
    minMonth(selection.from, `${selection.value.slice(0, 4)}-01`)
  )
  const optionMonths = listMonths(firstOption, current).reverse()
  const options = {
    months: optionMonths,
    quarters: [...new Set(optionMonths.map(quarterOf))],
    years: [...new Set(optionMonths.map((month) => month.slice(0, 4)))]
  }

  const { from, to } = selectionMonths(selection, current, start)
  const parsed = parseExportRange(from, to, today, format)
  const monthCount = parsed.success ? parsed.range.months.length : 0

  function changePeriod(period: ExportPeriod) {
    setSelection((prev) => changeSelectionPeriod(prev, period, current, start))
  }

  async function download() {
    if (!parsed.success) return
    setPending(true)

    try {
      const query = new URLSearchParams({
        format,
        from,
        to,
        ...(isPdf ? pdfOptions : {})
      })
      const response = await fetch(
        `/api/export/${workspaceId}?${query.toString()}`
      )

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(
          body?.error ?? "No se pudo generar el archivo. Intenta de nuevo"
        )
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileNameFrom(response, `tesoro.${format}`)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success("Archivo descargado")
      onDone()
    } catch {
      toast.error(
        "No se pudo descargar el archivo. Revisa tu conexión e intenta de nuevo"
      )
    } finally {
      setPending(false)
    }
  }

  return {
    format,
    setFormat,
    pdfOptions,
    setPdfOptions,
    selection,
    setSelection,
    changePeriod,
    pending,
    historyMonths,
    isPdf,
    maxMonths,
    allDisabled,
    options,
    parsed,
    monthCount,
    download
  }
}
