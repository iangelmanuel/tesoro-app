"use client"

import { type ReactNode, useMemo, useState } from "react"
import {
  Button,
  Checkbox,
  Chip,
  Description,
  Label,
  Table,
  cn
} from "@heroui/react"
import { LoaderCircle } from "lucide-react"
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

const STATUS_BADGES: Record<
  RowStatus,
  {
    label: string
    color: "default" | "success" | "warning" | "danger"
    variant: "secondary" | "soft" | "tertiary"
  }
> = {
  ready: { label: "Lista", color: "default", variant: "secondary" },
  duplicate: { label: "Duplicado", color: "warning", variant: "soft" },
  error: { label: "Error", color: "danger", variant: "soft" },
  skipped: { label: "Omitida", color: "default", variant: "tertiary" }
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
          variant={filter === "all" ? "primary" : "outline"}
          onPress={() => changeFilter("all")}
        >
          Todas · {rows.length}
        </Button>
        {(Object.keys(STATUS_LABELS) as RowStatus[]).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "primary" : "outline"}
            onPress={() => changeFilter(status)}
          >
            {STATUS_LABELS[status]} · {counts[status]}
          </Button>
        ))}
      </div>
      {empty > 0 && (
        <p className="-mt-3 text-sm text-muted">
          {empty === 1
            ? "1 fila vacía no se muestra"
            : `${empty} filas vacías no se muestran`}{" "}
          y cuenta como omitida.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Vista previa de la importación">
              <Table.Header>
                <Table.Column
                  isRowHeader
                  className="w-10"
                >
                  <span className="sr-only">Importar</span>
                </Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Hoja · fila</Table.Column>
                {columns.map((column) => (
                  <Table.Column
                    key={column.header}
                    className={
                      column.className === AMOUNT_CLASS
                        ? "text-right"
                        : undefined
                    }
                  >
                    {column.header}
                  </Table.Column>
                ))}
                <Table.Column>Motivos</Table.Column>
              </Table.Header>
              <Table.Body>
                {pageRows.length === 0 ? (
                  <Table.Row>
                    <Table.Cell
                      colSpan={columnCount}
                      className="text-center text-muted"
                    >
                      No hay filas con este estado
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  pageRows.map(({ row, index }) => (
                    <Table.Row
                      key={`${row.sheet}-${row.sourceRow}`}
                      className={cn(!row.selected && "text-muted")}
                    >
                      <Table.Cell>
                        <Checkbox
                          aria-label={`Importar fila ${row.sourceRow} de ${row.sheet}`}
                          isSelected={row.selected}
                          isDisabled={!row.value || importing}
                          onChange={() => onToggle(index)}
                        >
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={STATUS_BADGES[row.status].color}
                          variant={STATUS_BADGES[row.status].variant}
                        >
                          {STATUS_BADGES[row.status].label}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        {row.sheet} · {row.sourceRow}
                      </Table.Cell>
                      {columns.map((column) => (
                        <Table.Cell
                          key={column.header}
                          className={column.className}
                        >
                          {row.value === undefined
                            ? "—"
                            : column.cell(row.value)}
                        </Table.Cell>
                      ))}
                      <Table.Cell className="text-sm">
                        {row.reasons.join(" · ")}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            isDisabled={currentPage === 0}
            onPress={() => setPage(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted">
            Página {currentPage + 1} de {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            isDisabled={currentPage >= pageCount - 1}
            onPress={() => setPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {extra}

      {(blocked ?? error) && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {blocked ?? error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          isDisabled={importing}
          onPress={onBack}
        >
          Atrás
        </Button>
        <Button
          isDisabled={selectedCount === 0 || importing || Boolean(blocked)}
          onPress={onConfirm}
        >
          {importing && <LoaderCircle className="animate-spin" />}
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
              <span className="text-muted">
                {formatCurrency(balance.current, currency)}
              </span>{" "}
              →{" "}
              <span
                className={cn(
                  "font-medium",
                  balance.result < 0 && "text-danger"
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
    <Checkbox
      isSelected={checked}
      isDisabled={disabled}
      onChange={onChange}
      className="items-start"
    >
      <Checkbox.Control className="mt-0.5">
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content>
        <Label>Registrar también como gasto/ingreso</Label>
        <Description>
          Cada pago de préstamo crea un gasto en «Deudas» y cada abono de una
          cuenta por cobrar, un ingreso en «Cobros». Desmárcala si ya importaste
          estos pagos como movimientos.
        </Description>
      </Checkbox.Content>
    </Checkbox>
  )
}
