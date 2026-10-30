"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { cn } from "@/libs/utils"
import { SAMPLE_ROWS } from "../constants"
import {
  buildTable,
  cellText,
  columnName,
  tableBodyRows,
  tableRowCells
} from "../detect"
import type { SheetCells } from "../read-file"
import type { DetectedTable } from "../types"
import type { LoadedFile, SheetTable } from "./wizard-state"

interface TableStepProps {
  file: LoadedFile
  selectedSheets: string[]
  tables: SheetTable[]
  onToggleSheet: (sheet: string) => void
  onTableChange: (table: DetectedTable) => void
  onBack: () => void
  onNext: () => void
}

function tableLabel(table: DetectedTable) {
  return `Fila ${table.headerRow + 1}, columnas ${columnName(table.startCol)} a ${columnName(table.endCol)}`
}

function sameRange(a: DetectedTable, b: DetectedTable | null) {
  return (
    b !== null &&
    a.headerRow === b.headerRow &&
    a.startCol === b.startCol &&
    a.endCol === b.endCol
  )
}

// Paso 2: hojas, tabla detectada por hoja, ajuste manual y primeras filas
export function TableStep({
  file,
  selectedSheets,
  tables,
  onToggleSheet,
  onTableChange,
  onBack,
  onNext
}: TableStepProps) {
  const [primary] = tables
  const included = tables.filter((item) => item.table !== null)
  const canContinue = primary?.table != null

  return (
    <div className="flex flex-col gap-6">
      {!file.isCsv && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Hojas a importar</legend>
          <p className="text-sm text-muted-foreground">
            La primera hoja marcada define la tabla y el mapeo. En las demás se
            busca una tabla con los mismos encabezados.
          </p>
          <ul className="flex flex-col divide-y rounded-lg border">
            {file.sheets.map((sheet) => {
              const checked = selectedSheets.includes(sheet.name)
              const match = tables.find(
                (item) => item.sheet.name === sheet.name
              )
              const isPrimary = primary?.sheet.name === sheet.name

              return (
                <li
                  key={sheet.name}
                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                >
                  <Label className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleSheet(sheet.name)}
                    />
                    {sheet.name}
                  </Label>
                  {checked && isPrimary && <Badge>Define el mapeo</Badge>}
                  {checked && !isPrimary && match?.table && (
                    <Badge variant="secondary">
                      Coincide · {tableLabel(match.table)}
                    </Badge>
                  )}
                  {checked && !isPrimary && match && !match.table && (
                    <Badge variant="destructive">
                      No coincide · se excluye
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        </fieldset>
      )}

      {primary ? (
        <PrimaryTable
          sheet={primary.sheet}
          detected={file.detected[primary.sheet.name] ?? []}
          table={primary.table}
          onChange={onTableChange}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Marca al menos una hoja.
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onClick={onBack}
        >
          Elegir otro archivo
        </Button>
        <Button
          disabled={!canContinue}
          onClick={onNext}
        >
          Continuar con{" "}
          {included.length === 1 ? "1 hoja" : `${included.length} hojas`}
        </Button>
      </div>
    </div>
  )
}

interface PrimaryTableProps {
  sheet: SheetCells
  detected: DetectedTable[]
  table: DetectedTable | null
  onChange: (table: DetectedTable) => void
}

function PrimaryTable({ sheet, detected, table, onChange }: PrimaryTableProps) {
  const rowCount = sheet.cells.length
  const columnCount = Math.max(1, ...sheet.cells.map((row) => row.length))
  const columns = Array.from({ length: columnCount }, (_, index) => index)

  function adjust(changes: Partial<Omit<DetectedTable, "sheet" | "headers">>) {
    const headerRow = changes.headerRow ?? table?.headerRow ?? 0
    let startCol = changes.startCol ?? table?.startCol ?? 0
    let endCol = changes.endCol ?? table?.endCol ?? columnCount - 1
    if (startCol > endCol) {
      if (changes.startCol !== undefined) endCol = startCol
      else startCol = endCol
    }
    onChange(buildTable(sheet.cells, sheet.name, headerRow, startCol, endCol))
  }

  const sampleRows = table
    ? tableBodyRows(sheet.cells, table).slice(0, SAMPLE_ROWS)
    : []

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Tabla de «{sheet.name}»</h2>
        <p className="text-sm text-muted-foreground">
          {detected.length > 0
            ? "Elige una de las tablas detectadas o ajusta la fila de encabezados y las columnas."
            : "No detectamos una tabla. Indica la fila de encabezados y las columnas."}
        </p>
      </div>

      {detected.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {detected.map((item) => (
            <Button
              key={`${item.headerRow}-${item.startCol}`}
              size="sm"
              variant={sameRange(item, table) ? "default" : "outline"}
              onClick={() => onChange(item)}
            >
              {tableLabel(item)}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-header-row">Fila de encabezados</Label>
          <Input
            id="import-header-row"
            type="number"
            min={1}
            max={rowCount}
            value={(table?.headerRow ?? 0) + 1}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isInteger(value) && value >= 1 && value <= rowCount) {
                adjust({ headerRow: value - 1 })
              }
            }}
          />
        </div>
        <ColumnSelect
          id="import-start-col"
          label="Columna inicial"
          columns={columns}
          value={table?.startCol ?? 0}
          onChange={(startCol) => adjust({ startCol })}
        />
        <ColumnSelect
          id="import-end-col"
          label="Columna final"
          columns={columns}
          value={table?.endCol ?? columnCount - 1}
          onChange={(endCol) => adjust({ endCol })}
        />
      </div>

      {table && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-muted-foreground">
                  Fila
                </TableHead>
                {table.headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.headers.length + 1}
                    className="text-center text-muted-foreground"
                  >
                    La tabla no tiene filas de datos
                  </TableCell>
                </TableRow>
              ) : (
                sampleRows.map((row) => (
                  <TableRow key={row}>
                    <TableCell className="text-muted-foreground">
                      {row + 1}
                    </TableCell>
                    {tableRowCells(sheet.cells, table, row).map(
                      (cell, index) => (
                        <TableCell
                          key={index}
                          className={cn(
                            "max-w-48 truncate",
                            typeof cell === "number" &&
                              "text-right tabular-nums"
                          )}
                        >
                          {cellText(cell)}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

interface ColumnSelectProps {
  id: string
  label: string
  columns: number[]
  value: number
  onChange: (value: number) => void
}

function ColumnSelect({
  id,
  label,
  columns,
  value,
  onChange
}: ColumnSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger
          id={id}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem
              key={column}
              value={String(column)}
            >
              {columnName(column)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
