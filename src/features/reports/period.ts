import { format } from "date-fns"
import { es } from "date-fns/locale"
import { z } from "zod"
import { SITE } from "@/config/site"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import type {
  SearchParams,
  TransactionType
} from "@/features/transactions/filters"
import { currentMonth, monthRange, shiftMonth } from "@/libs/dates"

export const REPORTS_PATH = `${SITE.routes.dashboardPersonal}/reports`

export const REPORT_PERIODS = ["month", "quarter", "year", "range"] as const

export type ReportPeriod = (typeof REPORT_PERIODS)[number]

/** Meses que puede cubrir un rango, contando el primero y el último */
export const MAX_RANGE_MONTHS = 24

export interface ReportParams {
  period: ReportPeriod
  /** YYYY-MM, YYYY-Qn o YYYY según el periodo; null en `range` */
  value: string | null
  /** Primer día del periodo (YYYY-MM-DD), inclusivo */
  from: string
  /** Último día del periodo (YYYY-MM-DD), inclusivo */
  to: string
  label: string
  type: TransactionType
  /** Aviso cuando el rango pedido no es válido y se cayó al mes actual */
  warning?: string
}

const periodSchema = z.enum(REPORT_PERIODS)
const typeSchema = z.enum(TRANSACTION_TYPES)
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const quarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/)
const yearSchema = z.string().regex(/^\d{4}$/)
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealDate)

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** Descarta fechas con formato válido que no existen, como 2026-02-30 */
function isRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

// Date local con los componentes de la fecha, solo para formatear etiquetas
function toLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day ?? 1)
}

function monthsSpanned(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1
}

/** Valor del periodo actual en America/Bogota */
export function currentPeriodValue(
  period: Exclude<ReportPeriod, "range">,
  now = new Date()
) {
  const month = currentMonth(now)
  const [year, monthIndex] = month.split("-").map(Number)

  if (period === "month") return month
  if (period === "quarter") return `${year}-Q${Math.ceil(monthIndex / 3)}`
  return String(year)
}

function monthPeriod(value: string) {
  return {
    ...monthRange(value),
    label: format(toLocalDate(value), "MMMM yyyy", { locale: es })
  }
}

function quarterPeriod(value: string) {
  const [year, quarter] = value.split("-Q").map(Number)
  const firstMonth = (quarter - 1) * 3 + 1
  const lastMonth = `${year}-${String(firstMonth + 2).padStart(2, "0")}`

  return {
    from: `${year}-${String(firstMonth).padStart(2, "0")}-01`,
    to: monthRange(lastMonth).to,
    label: `T${quarter} ${year}`
  }
}

function yearPeriod(value: string) {
  return { from: `${value}-01-01`, to: `${value}-12-31`, label: value }
}

function rangeLabel(from: string, to: string) {
  const fromDate = toLocalDate(from)
  const toDate = toLocalDate(to)
  const sameYear = fromDate.getFullYear() === toDate.getFullYear()
  const start = format(fromDate, sameYear ? "d MMM" : "d MMM yyyy", {
    locale: es
  })

  return `${start} – ${format(toDate, "d MMM yyyy", { locale: es })}`
}

function rangeWarning(from: string | undefined, to: string | undefined) {
  const fromDate = dateSchema.safeParse(from)
  const toDate = dateSchema.safeParse(to)

  if (!fromDate.success || !toDate.success)
    return "Las fechas del rango no son válidas."
  if (fromDate.data > toDate.data)
    return "La fecha inicial es posterior a la final."
  if (monthsSpanned(fromDate.data, toDate.data) > MAX_RANGE_MONTHS) {
    return `El rango no puede cubrir más de ${MAX_RANGE_MONTHS} meses.`
  }
  return null
}

// Un valor inválido cae a su valor por defecto. Un rango inválido muestra un
// aviso y cae al mes actual. Nunca rompe la página.
export function parseReportParams(
  searchParams: SearchParams,
  now = new Date()
): ReportParams {
  const parsedPeriod = periodSchema.safeParse(first(searchParams.period))
  const parsedType = typeSchema.safeParse(first(searchParams.type))
  const type = parsedType.success ? parsedType.data : "expense"
  const period = parsedPeriod.success ? parsedPeriod.data : "month"
  const rawValue = first(searchParams.value)

  if (period === "range") {
    const from = first(searchParams.from)
    const to = first(searchParams.to)
    const warning = rangeWarning(from, to)

    if (!warning && from && to) {
      return {
        period,
        value: null,
        from,
        to,
        label: rangeLabel(from, to),
        type
      }
    }

    const value = currentPeriodValue("month", now)
    return {
      period: "month",
      value,
      ...monthPeriod(value),
      type,
      warning: warning ?? undefined
    }
  }

  if (period === "quarter") {
    const parsed = quarterSchema.safeParse(rawValue)
    const value = parsed.success ? parsed.data : currentPeriodValue(period, now)
    return { period, value, ...quarterPeriod(value), type }
  }

  if (period === "year") {
    const parsed = yearSchema.safeParse(rawValue)
    const value = parsed.success ? parsed.data : currentPeriodValue(period, now)
    return { period, value, ...yearPeriod(value), type }
  }

  const parsed = monthSchema.safeParse(rawValue)
  const value = parsed.success ? parsed.data : currentPeriodValue(period, now)
  return { period, value, ...monthPeriod(value), type }
}

/** Valor del periodo `delta` pasos antes o después (mes, trimestre o año) */
export function shiftPeriodValue(
  period: Exclude<ReportPeriod, "range">,
  value: string,
  delta: number
) {
  if (period === "month") return shiftMonth(value, delta)
  if (period === "year") return String(Number(value) + delta)

  const [year, quarter] = value.split("-Q").map(Number)
  const index = year * 4 + (quarter - 1) + delta
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`
}

export type ReportQuery =
  | {
      period: Exclude<ReportPeriod, "range">
      value: string
      type: TransactionType
    }
  | { period: "range"; from: string; to: string; type: TransactionType }

// Se escriben siempre periodo y tipo para que el enlace no cambie de
// significado con el tiempo y se conserve al recargar
export function buildReportQuery(query: ReportQuery) {
  const params = new URLSearchParams({ period: query.period })

  if (query.period === "range") {
    params.set("from", query.from)
    params.set("to", query.to)
  } else {
    params.set("value", query.value)
  }
  params.set("type", query.type)

  return params.toString()
}

/** Query de los parámetros ya validados, con cambios opcionales */
export function reportQueryFromParams(
  params: ReportParams,
  overrides: { type?: TransactionType } = {}
): ReportQuery {
  const type = overrides.type ?? params.type

  if (params.period === "range") {
    return { period: "range", from: params.from, to: params.to, type }
  }
  return { period: params.period, value: params.value ?? "", type }
}
