"use client"

import { type ReactNode, useId, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { CARD_LIST } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES, type Tone } from "@/components/dashboard/tone"
import { ToneBadge } from "@/components/dashboard/tone-badge"
import { FieldHelp } from "@/components/forms/field-label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldDescription } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { cn } from "@/libs/cn"
import { formatCurrency, formatDate } from "@/libs/format"
import type { ResultingBalance } from "../balances"
import { MONTH_NAMES, PREVIEW_PAGE_SIZE } from "../constants"
import type {
  DebtEntryValue,
  GoalContributionValue,
  PreviewRow,
  RecurringValue,
  RowStatus,
  TransactionValue
} from "../types"

type Filter = "all" | RowStatus

const STATUS_LABELS: Record<RowStatus, string> = {
  ready: "Listas",
  duplicate: "Posibles duplicados",
  error: "Con error",
  skipped: "Omitidas"
}

const STATUS_BADGES: Record<RowStatus, { label: string; tone: Tone }> = {
  ready: { label: "Lista", tone: "success" },
  duplicate: { label: "Duplicado", tone: "warning" },
  error: { label: "Error", tone: "danger" },
  skipped: { label: "Omitida", tone: "neutral" }
}

const TYPE_LABELS = { income: "Entrada", expense: "Salida" } as const

/** Columna de datos normalizados de la vista previa */
export interface PreviewColumn<V> {
  header: string
  className?: string
  cell: (value: V) => ReactNode
}

const AMOUNT_CLASS = "text-right whitespace-nowrap tabular-nums"

export function transactionColumns(
  currency: string,
  categoryNames: Record<string, string>,
  /** Solo con la columna Método mapeada */
  accountNames?: Record<string, string>
): PreviewColumn<TransactionValue>[] {
  const columns: PreviewColumn<TransactionValue>[] = [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Tipo", cell: (value) => TYPE_LABELS[value.type] },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(value.amount, currency)
    },
    {
      header: "Categoría",
      cell: (value) => categoryNames[value.categoryKey] ?? "—"
    },
    {
      header: "Descripción",
      className: "max-w-64 truncate",
      cell: (value) => value.description
    }
  ]

  if (accountNames) {
    columns.splice(4, 0, {
      header: "Cuenta",
      cell: (value) =>
        value.accountKey === null
          ? "Sin cuenta"
          : (accountNames[value.accountKey] ?? "—")
    })
  }
  return columns
}

/** "Mensual, día 5" o "Anual, 15 de marzo" */
function frequencyText(value: RecurringValue) {
  if (value.frequency === "monthly") return `Mensual, día ${value.day_of_month}`
  const month = MONTH_NAMES[(value.month_of_year ?? 1) - 1]
  return `Anual, ${value.day_of_month} de ${month}`
}

export function recurringColumns(
  currency: string,
  categoryNames: Record<string, string>
): PreviewColumn<RecurringValue>[] {
  return [
    {
      header: "Nombre",
      className: "max-w-64 truncate",
      cell: (value) => value.name
    },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(value.amount, currency)
    },
    {
      header: "Categoría",
      cell: (value) => categoryNames[value.categoryKey] ?? "—"
    },
    {
      header: "Frecuencia",
      className: "whitespace-nowrap",
      cell: frequencyText
    },
    {
      header: "Inicio",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.starts_on)
    },
    {
      header: "Fin",
      className: "whitespace-nowrap",
      cell: (value) => (value.ends_on ? formatDate(value.ends_on) : "—")
    }
  ]
}

/** Pago, Cargo (ajuste > 0) o Ajuste que baja el saldo (ajuste < 0) */
function debtEntryLabel(value: DebtEntryValue) {
  if (value.kind === "payment") return "Pago"
  return value.amount > 0 ? "Cargo" : "Ajuste que baja el saldo"
}

export function debtEntryColumns(
  currency: string,
  debtNames: Record<string, string>
): PreviewColumn<DebtEntryValue>[] {
  return [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Deuda", cell: (value) => debtNames[value.debtId] ?? "—" },
    { header: "Tipo", cell: debtEntryLabel },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(Math.abs(value.amount), currency)
    },
    {
      header: "Nota",
      className: "max-w-64 truncate",
      cell: (value) => value.note ?? "—"
    }
  ]
}

export function goalContributionColumns(
  currency: string,
  goalNames: Record<string, string>
): PreviewColumn<GoalContributionValue>[] {
  return [
    {
      header: "Fecha",
      className: "whitespace-nowrap",
      cell: (value) => formatDate(value.occurred_on)
    },
    { header: "Meta", cell: (value) => goalNames[value.goalId] ?? "—" },
    {
      header: "Tipo",
      cell: (value) => (value.amount < 0 ? "Retiro" : "Aporte")
    },
    {
      header: "Monto",
      className: AMOUNT_CLASS,
      cell: (value) => formatCurrency(Math.abs(value.amount), currency)
    },
    {
      header: "Nota",
      className: "max-w-64 truncate",
      cell: (value) => value.note ?? "—"
    }
  ]
}

interface PreviewStepProps<V> {
  rows: PreviewRow<V>[]
  columns: PreviewColumn<V>[]
  /** Filas vacías: no se muestran y suman en omitidas */
  empty: number
  /** "1 movimiento", "3 gastos fijos" */
  countLabel: (count: number) => string
  /** Bloque bajo la tabla: saldos y casilla de movimiento */
  extra?: ReactNode
  /** Motivo que impide importar, como un saldo negativo */
  blocked?: string | null
  importing: boolean
  error: string | null
  onToggle: (index: number) => void
  onBack: () => void
  onConfirm: () => void
}

// Paso 5: contadores por estado, filtro, tabla paginada con casilla y el
// botón para confirmar. Las columnas de datos dependen del destino.
export function PreviewStep<V>({
  rows,
  columns,
  empty,
  countLabel,
  extra,
  blocked,
  importing,
  error,
  onToggle,
  onBack,
  onConfirm
}: PreviewStepProps<V>) {
  const [filter, setFilter] = useState<Filter>("all")
  const [page, setPage] = useState(0)

  const counts = useMemo(() => {
    const result: Record<RowStatus, number> = {
      ready: 0,
      duplicate: 0,
      error: 0,
      skipped: 0
    }
    for (const row of rows) result[row.status]++
    return result
  }, [rows])
  const selectedCount = rows.filter((row) => row.selected).length

  const visible = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => filter === "all" || row.status === filter),
    [rows, filter]
  )
  const pageCount = Math.max(1, Math.ceil(visible.length / PREVIEW_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = visible.slice(
    currentPage * PREVIEW_PAGE_SIZE,
    (currentPage + 1) * PREVIEW_PAGE_SIZE
  )
  // Casilla, estado, hoja · fila, columnas de datos y motivos
  const columnCount = columns.length + 4

  function changeFilter(next: Filter) {
    setFilter(next)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Filtrar por estado"
        className="flex flex-wrap gap-2"
      >
        <Button
          type="button"
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          aria-pressed={filter === "all"}
          onClick={() => changeFilter("all")}
        >
          Todas · {rows.length}
        </Button>
        {(Object.keys(STATUS_LABELS) as RowStatus[]).map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={filter === status ? "default" : "outline"}
            aria-pressed={filter === status}
            onClick={() => changeFilter(status)}
          >
            {STATUS_LABELS[status]} · {counts[status]}
          </Button>
        ))}
      </div>
      {empty > 0 && (
        <p className="-mt-3 text-sm text-muted-foreground">
          {empty === 1
            ? "1 fila vacía no se muestra"
            : `${empty} filas vacías no se muestran`}{" "}
          y cuenta como omitida.
        </p>
      )}

      <div className="rounded-2xl bg-subtle px-2">
        <Table aria-label="Vista previa de la importación">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <span className="sr-only">Importar</span>
              </TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Hoja · fila</TableHead>
              {columns.map((column) => (
                <TableHead
                  key={column.header}
                  className={
                    column.className === AMOUNT_CLASS ? "text-right" : undefined
                  }
                >
                  {column.header}
                </TableHead>
              ))}
              <TableHead>Motivos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="text-center text-muted-foreground"
                >
                  No hay filas con este estado
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map(({ row, index }) => (
                <TableRow
                  key={`${row.sheet}-${row.sourceRow}`}
                  className={cn(!row.selected && "text-muted-foreground")}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Importar fila ${row.sourceRow} de ${row.sheet}`}
                      checked={row.selected}
                      disabled={!row.value || importing}
                      onCheckedChange={() => onToggle(index)}
                    />
                  </TableCell>
                  <TableCell>
                    <ToneBadge
                      className={
                        TONE_BADGE_CLASSES[STATUS_BADGES[row.status].tone]
                      }
                    >
                      {STATUS_BADGES[row.status].label}
                    </ToneBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.sheet} · {row.sourceRow}
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell
                      key={column.header}
                      className={column.className}
                    >
                      {row.value === undefined ? "—" : column.cell(row.value)}
                    </TableCell>
                  ))}
                  <TableCell className="text-sm">
                    {row.reasons.join(" · ")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span
            className="text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            Página {currentPage + 1} de {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {extra}

      {(blocked ?? error) && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {blocked ?? error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={importing}
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          type="button"
          disabled={selectedCount === 0 || importing || Boolean(blocked)}
          onClick={onConfirm}
        >
          {importing && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          Importar {countLabel(selectedCount)}
        </Button>
      </div>
    </div>
  )
}

interface BalancesProps {
  title: string
  balances: ResultingBalance[]
  currency: string
}

// Saldo actual → saldo resultante de cada deuda o meta con filas marcadas
export function Balances({ title, balances, currency }: BalancesProps) {
  if (balances.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
        {balances.map((balance) => (
          <li
            key={balance.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <span>{balance.name}</span>
            <span className="tabular-nums">
              <span className="text-muted-foreground">
                {formatCurrency(balance.current, currency)}
              </span>{" "}
              →{" "}
              <span
                className={cn(
                  "font-medium",
                  balance.result < 0 && "text-(--expense)"
                )}
              >
                {formatCurrency(balance.result, currency)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface CreateTransactionsProps {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}

// Casilla para crear el gasto o ingreso de cada pago de préstamo o abono
export function CreateTransactionsField({
  checked,
  disabled,
  onChange
}: CreateTransactionsProps) {
  const id = useId()

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={`${id}-description`}
        className="mt-3"
      />
      <div className="flex flex-col gap-1">
        <div className="flex min-h-11 items-center gap-0.5">
          <Label
            htmlFor={id}
            className="cursor-pointer"
          >
            Registrar también como salida/entrada
          </Label>
          <FieldHelp
            help="import.alsoRegister"
            label="Registrar también el movimiento"
          />
        </div>
        <FieldDescription id={`${id}-description`}>
          Cada pago de préstamo crea una salida en «Deudas». Cada abono de una
          cuenta por cobrar crea una entrada en «Cobros». Desmárcala si ya
          importaste estos pagos como movimientos.
        </FieldDescription>
      </div>
    </div>
  )
}
