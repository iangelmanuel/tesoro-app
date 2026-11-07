import { z } from "zod"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { shiftMonth } from "@/libs/dates"
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportRange,
  MAX_EXPORT_MONTHS
} from "./types"

export const exportMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener el formato AAAA-MM.")

export const exportFormatSchema = z.enum(EXPORT_FORMATS, {
  error: "El formato debe ser xlsx o csv."
})

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
export function parseExportRange(
  from: unknown,
  to: unknown,
  today: string
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
