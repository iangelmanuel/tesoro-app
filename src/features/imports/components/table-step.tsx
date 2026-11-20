"use client"

import { useId } from "react"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES } from "@/components/dashboard/tone"
import { ToneBadge } from "@/components/dashboard/tone-badge"
import { FieldHelp } from "@/components/forms/field-label"
import { SelectField } from "@/components/forms/select-field"
import { TextInputField } from "@/components/forms/text-input-field"
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
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"
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
          <legend className="mb-2 flex items-center gap-0.5 text-sm font-medium">
            Hojas a importar
            <FieldHelp
              help="import.sheets"
              label="Hojas a importar"
            />
          </legend>
          <p className="text-sm text-muted-foreground">
            La primera hoja marcada define la tabla y el mapeo. En las demás se
            busca una tabla con los mismos encabezados.
          </p>
          <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4 py-1")}>
            {file.sheets.map((sheet) => {
              const checked = selectedSheets.includes(sheet.name)
              const match = tables.find(
                (item) => item.sheet.name === sheet.name
              )
              const isPrimary = primary?.sheet.name === sheet.name

              return (
                <SheetRow
                  key={sheet.name}
                  name={sheet.name}
                  checked={checked}
                  onToggle={() => onToggleSheet(sheet.name)}
                >
                  {checked && isPrimary && (
                    <ToneBadge className="bg-primary text-primary-foreground">
                      Define el mapeo
                    </ToneBadge>
                  )}
                  {checked && !isPrimary && match?.table && (
                    <ToneBadge className={TONE_BADGE_CLASSES.neutral}>
                      Coincide · {tableLabel(match.table)}
                    </ToneBadge>
                  )}
                  {checked && !isPrimary && match && !match.table && (
                    <ToneBadge className={TONE_BADGE_CLASSES.danger}>
                      No coincide · se excluye
                    </ToneBadge>
                  )}
                </SheetRow>
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
          type="button"
          variant="outline"
          onClick={onBack}
        >
          Elegir otro archivo
        </Button>
        <Button
          type="button"
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
              type="button"
              size="sm"
              variant={sameRange(item, table) ? "default" : "outline"}
              aria-pressed={sameRange(item, table)}
              onClick={() => onChange(item)}
            >
              {tableLabel(item)}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <TextInputField
          label="Fila de encabezados"
          help="import.headerRow"
          type="number"
          inputMode="numeric"
          min={1}
          max={rowCount}
          value={String((table?.headerRow ?? 0) + 1)}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isInteger(value) && value >= 1 && value <= rowCount) {
              adjust({ headerRow: value - 1 })
            }
          }}
        />
        <ColumnSelect
          label="Columna inicial"
          help="import.firstColumn"
          columns={columns}
          value={table?.startCol ?? 0}
          onChange={(startCol) => adjust({ startCol })}
        />
        <ColumnSelect
          label="Columna final"
          help="import.lastColumn"
          columns={columns}
          value={table?.endCol ?? columnCount - 1}
          onChange={(endCol) => adjust({ endCol })}
        />
      </div>

      {table && (
        <div className="rounded-2xl bg-subtle px-2">
          <Table aria-label="Datos de la hoja">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">Fila</TableHead>
                {table.headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
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
                    <TableCell className="text-muted-foreground tabular-nums">
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
  label: string
  columns: number[]
  value: number
  onChange: (value: number) => void
  help: FieldHelpKey
}

function ColumnSelect({
  label,
  help,
  columns,
  value,
  onChange
}: ColumnSelectProps) {
  return (
    <SelectField
      label={label}
      help={help}
      value={String(value)}
      onChange={(next) => onChange(Number(next))}
      options={columns.map((column) => ({
        value: String(column),
        label: columnName(column)
      }))}
    />
  )
}

/** Hoja con su casilla y los chips de coincidencia */
function SheetRow({
  name,
  checked,
  onToggle,
  children
}: {
  name: string
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const id = useId()

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3",
        CARD_ROW,
        "py-2 first:pt-2 last:pb-2"
      )}
    >
      <div className="flex min-h-11 flex-1 items-center gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onToggle}
        />
        <Label
          htmlFor={id}
          className="min-h-11 flex-1 cursor-pointer font-normal"
        >
          {name}
        </Label>
      </div>
      {children}
    </li>
  )
}
