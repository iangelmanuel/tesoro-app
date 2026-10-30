"use client"

import { type ReactNode, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/libs/format"
import { cn } from "@/libs/utils"
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

const STATUS_BADGES: Record<
  RowStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
  }
> = {
  ready: { label: "Lista", variant: "secondary" },
  duplicate: { label: "Duplicado", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  skipped: { label: "Omitida", variant: "outline" }
}

const TYPE_LABELS = { income: "Ingreso", expense: "Gasto" } as const

/** Columna de datos normalizados de la vista previa */
export interface PreviewColumn<V> {
  header: string
  className?: string
  cell: (value: V) => ReactNode
}

const AMOUNT_CLASS = "text-right whitespace-nowrap tabular-nums"

export function transactionColumns(
  currency: string,
  categoryNames: Record<string, string>
): PreviewColumn<TransactionValue>[] {
  return [
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

/** Pago, Cargo (ajuste > 0) o Ajuste a la baja (ajuste < 0) */
function debtEntryLabel(value: DebtEntryValue) {
  if (value.kind === "payment") return "Pago"
  return value.amount > 0 ? "Cargo" : "Ajuste a la baja"
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
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => changeFilter("all")}
        >
          Todas · {rows.length}
        </Button>
        {(Object.keys(STATUS_LABELS) as RowStatus[]).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "default" : "outline"}
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

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
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
              <TableRow>
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
                    <Badge variant={STATUS_BADGES[row.status].variant}>
                      {STATUS_BADGES[row.status].label}
                    </Badge>
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
            size="sm"
            variant="outline"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {currentPage + 1} de {pageCount}
          </span>
          <Button
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
          variant="outline"
          disabled={importing}
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          disabled={selectedCount === 0 || importing || Boolean(blocked)}
          onClick={onConfirm}
        >
          {importing && (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
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
      <ul className="flex flex-col divide-y rounded-lg border">
        {balances.map((balance) => (
          <li
            key={balance.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
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
                  balance.result < 0 && "text-destructive"
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
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id="import-create-transactions"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="import-create-transactions">
          Registrar también como gasto/ingreso
        </Label>
        <p className="text-sm text-muted-foreground">
          Cada pago de préstamo crea un gasto en «Deudas» y cada abono de una
          cuenta por cobrar, un ingreso en «Cobros». Desmárcala si ya importaste
          estos pagos como movimientos.
        </p>
      </div>
    </div>
  )
}
