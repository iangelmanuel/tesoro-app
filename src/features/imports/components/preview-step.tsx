"use client"

import { type ReactNode, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import {
  TONE_BADGE_CLASSES,
  type Tone
} from "@/components/dashboard/feedback/tone"
import { ToneBadge } from "@/components/dashboard/feedback/tone-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { cn } from "@/libs/cn"
import { PREVIEW_PAGE_SIZE } from "../constants"
import type { PreviewRow, RowStatus } from "../types"
import { AMOUNT_CLASS, type PreviewColumn } from "./preview-columns"

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
