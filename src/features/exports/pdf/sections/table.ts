import type {
  Content,
  CustomTableLayout,
  Node,
  NodeQueries,
  TableCell
} from "pdfmake/interfaces"
import { formatCurrency } from "@/libs/format"
import type { ColumnKind } from "../../columns"
import type { AmountTone } from "../../workbook/theme"
import type { PdfContext } from "../types"

// Tabla reutilizable del PDF (SPEC 33): banda de título, encabezado de
// columnas (se repite al saltar de página), filas, fila de total opcional y
// fila vacía en cursiva. Ninguna fila se parte entre páginas y la banda de
// título no queda sola al final de una página: `keepTitlesWithTables` la
// pasa a la siguiente si su tabla no alcanza a empezar en la misma.
//
// Los textos del usuario entran como texto plano de pdfmake: nunca HTML.

export interface PdfColumn<T> {
  header: string
  kind: ColumnKind
  /** Valor de la celda. money y percent esperan número; date, YYYY-MM-DD */
  value: (row: T) => string | number | null | undefined
  /** Color (tema Color) o signo (Ahorro de tinta) del monto según la fila */
  tone?: (row: T) => AmountTone | null
  /** Ancho propio; por defecto fijo en montos, fechas y horas, y "*" en texto */
  width?: number | "*" | "auto"
}

export interface PdfTableOptions<T> {
  title: string
  columns: PdfColumn<T>[]
  rows: T[]
  /** Fila de total: etiqueta en la primera columna y un valor por columna */
  total?: {
    label: string
    values: (string | number | null)[]
    /** Tono por columna, como `PdfColumn.tone` */
    tones?: (AmountTone | null)[]
  }
  /** Por defecto "Sin movimientos este mes" */
  emptyText?: string
  /** Tabla compacta (8 pt), para Movimientos */
  compact?: boolean
}

const EMPTY_TEXT = "Sin movimientos este mes"

/**
 * Anchos fijos por tipo, en puntos. pdfmake no aplica `tabular-nums`:
 * los montos van alineados a la derecha en columna de ancho fijo.
 */
const FIXED_WIDTHS: Record<ColumnKind, number | null> = {
  money: 78,
  percent: 50,
  date: 54,
  time: 34,
  text: null
}

const COMPACT_SCALE = 0.9

const PERCENT_FORMAT = new Intl.NumberFormat("es-CO", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

/** "−" tipográfico, no guion */
const MINUS = "−"

const SIGNS: Record<AmountTone, string> = {
  income: "+",
  expense: MINUS,
  transfer: ""
}

function formatValue(
  ctx: PdfContext,
  kind: ColumnKind,
  raw: string | number | null | undefined,
  tone: AmountTone | null
) {
  if (raw === null || raw === undefined || raw === "") return ""

  switch (kind) {
    case "money": {
      const amount = Number(raw)
      const text = formatCurrency(amount).replace("-", MINUS)
      return ctx.theme.signedAmounts && tone && amount >= 0
        ? `${SIGNS[tone]}${text}`
        : text
    }
    case "percent":
      return PERCENT_FORMAT.format(Number(raw)).replace("-", MINUS)
    case "date": {
      const [year, month, day] = String(raw).split("-")
      return `${day}/${month}/${year}`
    }
    case "time":
      return String(raw).slice(0, 5)
    default:
      return String(raw)
  }
}

const ALIGNMENT: Record<ColumnKind, "left" | "center" | "right"> = {
  text: "left",
  date: "left",
  time: "left",
  money: "right",
  percent: "right"
}

function columnWidths<T>(columns: PdfColumn<T>[], compact: boolean) {
  const widths = columns.map((column) => {
    if (column.width !== undefined) return column.width
    const fixed = FIXED_WIDTHS[column.kind]
    if (fixed === null) return "*"
    return compact ? Math.round(fixed * COMPACT_SCALE) : fixed
  })

  // La tabla siempre ocupa el ancho útil
  if (!widths.includes("*")) widths[0] = "*"
  return widths
}

let tableCount = 0

/**
 * Añade `id` (y `headlineLevel`) a un nodo. pdfmake los pasa a
 * `pageBreakBefore` en cualquier nodo, pero sus tipos solo declaran `id`
 * en algunos
 */
function withId(node: Content, id: string, headlineLevel?: number): Content {
  return Object.assign(node as object, { id, headlineLevel }) as Content
}

const TITLE_PREFIX = "pdf-title:"
const TABLE_PREFIX = "pdf-table:"

export function pdfTable<T>(
  ctx: PdfContext,
  options: PdfTableOptions<T>
): Content {
  const { theme } = ctx
  const compact = options.compact ?? false
  const cellStyle = compact ? "cellCompact" : "cell"
  const { columns, rows, total } = options
  const padY = compact ? 2 : 3
  const uid = String(++tableCount)

  const header: TableCell[] = columns.map((column) => ({
    text: column.header,
    style: "tableHeader",
    alignment: ALIGNMENT[column.kind],
    fillColor: theme.filled ? theme.accentTint : undefined
  }))

  const body: TableCell[][] = [header]

  if (rows.length === 0) {
    body.push([
      {
        text: options.emptyText ?? EMPTY_TEXT,
        style: "empty",
        colSpan: columns.length
      },
      ...columns.slice(1).map(() => ({ text: "" }))
    ])
  } else {
    for (const row of rows) {
      body.push(
        columns.map((column) => {
          const tone = column.tone?.(row) ?? null
          const text = formatValue(ctx, column.kind, column.value(row), tone)
          const isAmount = column.kind === "money"
          return {
            text,
            style: cellStyle,
            alignment: ALIGNMENT[column.kind],
            noWrap: isAmount,
            color: isAmount && tone ? theme.tone[tone] : undefined
          }
        })
      )
    }
  }

  const hasTotal = Boolean(total) && rows.length > 0
  if (total && hasTotal) {
    body.push(
      columns.map((column, index) => {
        const tone = total.tones?.[index] ?? null
        const text =
          index === 0
            ? total.label
            : formatValue(ctx, column.kind, total.values[index], tone)
        return {
          text,
          style: [cellStyle, "total"],
          alignment: index === 0 ? "left" : ALIGNMENT[column.kind],
          noWrap: column.kind === "money",
          color: column.kind === "money" && tone ? theme.tone[tone] : undefined,
          fillColor: theme.filled ? theme.totalTint : undefined
        }
      })
    )
  }

  const lastRow = body.length
  const totalRow = hasTotal ? lastRow - 1 : -1

  const layout: CustomTableLayout = {
    hLineWidth: (i) => {
      if (i === 1) return theme.lineWidth
      if (hasTotal && i === totalRow) return theme.lineWidth
      if (!theme.filled && i === lastRow) return theme.lineWidth
      return 0
    },
    vLineWidth: () => 0,
    hLineColor: () => theme.line,
    fillColor: (rowIndex) => {
      if (!theme.zebra || rowIndex === 0 || rowIndex === totalRow) return null
      return rowIndex % 2 === 0 ? theme.zebra : null
    },
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => padY,
    paddingBottom: () => padY
  }

  const titleNode: Content = theme.filled
    ? {
        table: {
          widths: ["*"],
          body: [[{ text: options.title, style: "tableTitle" }]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => theme.accent,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4
        }
      }
    : {
        table: {
          widths: ["*"],
          body: [[{ text: options.title, style: "tableTitle" }]]
        },
        layout: {
          hLineWidth: (i) => (i === 1 ? theme.lineWidth * 2 : 0),
          vLineWidth: () => 0,
          hLineColor: () => theme.accentDark,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 2,
          paddingBottom: () => 3
        }
      }

  const title = withId(titleNode, `${TITLE_PREFIX}${uid}`, 1)

  return {
    stack: [
      title,
      withId(
        {
          table: {
            widths: columnWidths(columns, compact),
            headerRows: 1,
            keepWithHeaderRows: 1,
            dontBreakRows: true,
            body
          },
          layout
        },
        `${TABLE_PREFIX}${uid}`
      )
    ],
    margin: [0, 0, 0, 16]
  }
}

/**
 * Espacio mínimo bajo la banda de título para que no quede sola: banda,
 * encabezado de columnas y una fila (en puntos, con holgura)
 */
const MIN_SPACE_BELOW_TITLE = 80

/**
 * `pageBreakBefore` del documento: si bajo una banda de título no caben su
 * encabezado y la primera fila, la banda pasa a la página siguiente.
 *
 * Se decide por espacio y no por los nodos que la siguen: pdfmake deja a la
 * tabla y a sus celdas la posición del primer intento aunque
 * `keepWithHeaderRows` las haya llevado a la página siguiente.
 */
export function keepTitlesWithTables(node: Node, queries: NodeQueries) {
  if (node.headlineLevel !== 1 || !node.id?.startsWith(TITLE_PREFIX)) {
    return false
  }

  const { pageInnerHeight, verticalRatio } = node.startPosition
  const spaceBelow = pageInnerHeight * (1 - verticalRatio)
  if (spaceBelow < MIN_SPACE_BELOW_TITLE) return true

  // Por si el tamaño de la página cambia: la tabla tiene que empezar aquí
  const tableId = node.id.replace(TITLE_PREFIX, TABLE_PREFIX)
  return !queries
    .getFollowingNodesOnPage()
    .some((following) => following.id === tableId)
}
