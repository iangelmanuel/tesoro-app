"use client"

import { useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { PREVIEW_PAGE_SIZE } from "../constants"
import type { PreviewRow, RowStatus } from "../types"

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

interface PreviewStepProps {
  rows: PreviewRow[]
  /** Filas vacías: no se muestran y suman en omitidas */
  empty: number
  currency: string
  /** categoryKey → nombre a mostrar */
  categoryNames: Record<string, string>
  importing: boolean
  error: string | null
  onToggle: (index: number) => void
  onBack: () => void
  onConfirm: () => void
}

// Paso 5: contadores por estado, filtro, tabla paginada con casilla y el
// botón para confirmar
export function PreviewStep({
  rows,
  empty,
  currency,
  categoryNames,
  importing,
  error,
  onToggle,
  onBack,
  onConfirm
}: PreviewStepProps) {
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
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Motivos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
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
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`Importar fila ${row.sourceRow} de ${row.sheet}`}
                      checked={row.selected}
                      disabled={!row.value || importing}
                      onChange={() => onToggle(index)}
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
                  <TableCell className="whitespace-nowrap">
                    {row.value ? formatDate(row.value.occurred_on) : "—"}
                  </TableCell>
                  <TableCell>
                    {row.value ? TYPE_LABELS[row.value.type] : "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {row.value
                      ? formatCurrency(row.value.amount, currency)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {row.value
                      ? (categoryNames[row.value.categoryKey] ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {row.value?.description ?? "—"}
                  </TableCell>
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

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
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
          disabled={selectedCount === 0 || importing}
          onClick={onConfirm}
        >
          {importing && (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin"
            />
          )}
          Importar{" "}
          {selectedCount === 1
            ? "1 movimiento"
            : `${selectedCount.toLocaleString("es-CO")} movimientos`}
        </Button>
      </div>
    </div>
  )
}
