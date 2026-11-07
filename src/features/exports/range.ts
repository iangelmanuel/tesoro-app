import { z } from "zod"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { shiftMonth } from "@/libs/dates"
import {
  DEFAULT_PDF_OPTIONS,
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportRange,
  MAX_EXPORT_MONTHS,
  MAX_PDF_MONTHS,
  PDF_ORIENTATIONS,
  PDF_SIZES,
  PDF_THEMES,
  type PdfOptions
} from "./types"

export const exportMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener el formato AAAA-MM.")

export const exportFormatSchema = z.enum(EXPORT_FORMATS, {
  error: "El formato debe ser xlsx, csv o pdf."
})

export const PDF_MONTHS_ERROR = `El PDF admite hasta ${MAX_PDF_MONTHS} meses.`

// Opciones del PDF (SPEC 33). Ausentes toman el valor por defecto; un valor
// que no está en la lista es un error
const pdfOptionsSchema = z.object({
  size: z.enum(PDF_SIZES).default(DEFAULT_PDF_OPTIONS.size),
  orientation: z
    .enum(PDF_ORIENTATIONS)
    .default(DEFAULT_PDF_OPTIONS.orientation),
  theme: z.enum(PDF_THEMES).default(DEFAULT_PDF_OPTIONS.theme)
})

export type ParsedPdfOptions =
  { success: true; options: PdfOptions } | { success: false; error: string }

/** `null` (parámetro ausente) cuenta como ausente */
export function parsePdfOptions(raw: {
  size: string | null
  orientation: string | null
  theme: string | null
}): ParsedPdfOptions {
  const parsed = pdfOptionsSchema.safeParse({
    size: raw.size ?? undefined,
    orientation: raw.orientation ?? undefined,
    theme: raw.theme ?? undefined
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Las opciones del PDF no son válidas."
    }
  }

  return { success: true, options: parsed.data }
}

/** Meses entre `from` y `to` (YYYY-MM), contando ambos */
export function monthsSpanned(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

/** ["2026-01", "2026-02", ...] de `from` a `to` (YYYY-MM), inclusivo */
export function listMonths(from: string, to: string) {
  const count = monthsSpanned(from, to)
  return Array.from({ length: Math.max(count, 0) }, (_, index) =>
    shiftMonth(from, index)
  )
}

export type ParsedExportRange =
  { success: true; range: ExportRange } | { success: false; error: string }

// Valida `from` y `to` (YYYY-MM) contra hoy (YYYY-MM-DD en America/Bogota).
// Lo usan el Route Handler y el diálogo, para que ambos rechacen lo mismo.
// Con PDF el tope es de 12 meses; con Excel y CSV, de 36.
export function parseExportRange(
  from: unknown,
  to: unknown,
  today: string,
  format: ExportFormat = "xlsx"
): ParsedExportRange {
  const parsedFrom = exportMonthSchema.safeParse(from)
  const parsedTo = exportMonthSchema.safeParse(to)

  if (!parsedFrom.success || !parsedTo.success) {
    return { success: false, error: "Los meses del periodo no son válidos." }
  }

  const fromMonth = parsedFrom.data
  const toMonth = parsedTo.data
  const current = today.slice(0, 7)

  if (fromMonth > toMonth) {
    return {
      success: false,
      error: "El mes inicial es posterior al mes final."
    }
  }
  if (toMonth > current) {
    return {
      success: false,
      error: "El periodo no puede terminar después del mes actual."
    }
  }
  if (format === "pdf" && monthsSpanned(fromMonth, toMonth) > MAX_PDF_MONTHS) {
    return { success: false, error: PDF_MONTHS_ERROR }
  }
  if (monthsSpanned(fromMonth, toMonth) > MAX_EXPORT_MONTHS) {
    return {
      success: false,
      error: `El periodo no puede cubrir más de ${MAX_EXPORT_MONTHS} meses.`
    }
  }

  return {
    success: true,
    range: {
      from: fromMonth,
      to: toMonth,
      months: listMonths(fromMonth, toMonth)
    }
  }
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
]

/**
 * "Octubre 2026" desde YYYY-MM. Es el nombre de la hoja de cada mes: único,
 * de menos de 31 caracteres y sin `: \ / ? * [ ]`
 */
export function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`
}

/** "Octubre 2026" o "Noviembre 2026 (en curso)". Lo usan el Excel y el PDF */
export function monthTitle(month: string, today: string) {
  const label = monthLabel(month)
  return month === today.slice(0, 7) ? `${label} (en curso)` : label
}

const GENERATED_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC"
})

/** "6 nov 2026" desde YYYY-MM-DD. Lo usan el Excel y el PDF */
export function formatGenerated(today: string) {
  const [year, month, day] = today.split("-").map(Number)
  return GENERATED_FORMAT.format(new Date(Date.UTC(year, month - 1, day)))
    .replace(/\./g, "")
    .replace(/ de /g, " ")
}

const MAX_SLUG_LENGTH = 40

/** Minúsculas, sin tildes, palabras con guiones y máximo 40 caracteres */
export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "")

  return slug || "empresa"
}

function periodSlug(range: Pick<ExportRange, "from" | "to">) {
  if (range.from === range.to) return range.from

  const fromYear = range.from.slice(0, 4)
  if (range.from === `${fromYear}-01` && range.to === `${fromYear}-12`) {
    return fromYear
  }

  return `${range.from}_${range.to}`
}

/** tesoro-<espacio>-<periodo>.<ext> */
export function exportFileName(
  workspace: { type: WorkspaceType; name: string },
  range: Pick<ExportRange, "from" | "to">,
  format: ExportFormat
) {
  const space =
    workspace.type === "personal" ? "personal" : slugify(workspace.name)

  return `tesoro-${space}-${periodSlug(range)}.${format}`
}
