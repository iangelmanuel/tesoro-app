"use client"

import {
  Button,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Table,
  TextField,
  cn
} from "@heroui/react"
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
          <p className="text-sm text-muted">
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
                  <Checkbox
                    isSelected={checked}
                    onChange={() => onToggleSheet(sheet.name)}
                    className="flex-1"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>{sheet.name}</Checkbox.Content>
                  </Checkbox>
                  {checked && isPrimary && (
                    <Chip
                      size="sm"
                      color="accent"
                      variant="primary"
                    >
                      Define el mapeo
                    </Chip>
                  )}
                  {checked && !isPrimary && match?.table && (
                    <Chip size="sm">Coincide · {tableLabel(match.table)}</Chip>
                  )}
                  {checked && !isPrimary && match && !match.table && (
                    <Chip
                      size="sm"
                      color="danger"
                      variant="soft"
                    >
                      No coincide · se excluye
                    </Chip>
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
        <p className="text-sm text-muted">Marca al menos una hoja.</p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onPress={onBack}
        >
          Elegir otro archivo
        </Button>
        <Button
          isDisabled={!canContinue}
          onPress={onNext}
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
        <p className="text-sm text-muted">
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
              variant={sameRange(item, table) ? "primary" : "outline"}
              onPress={() => onChange(item)}
            >
              {tableLabel(item)}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          value={String((table?.headerRow ?? 0) + 1)}
          onChange={(next) => {
            const value = Number(next)
            if (Number.isInteger(value) && value >= 1 && value <= rowCount) {
              adjust({ headerRow: value - 1 })
            }
          }}
          className="flex flex-col gap-1.5"
        >
          <Label>Fila de encabezados</Label>
          <Input
            type="number"
            min={1}
            max={rowCount}
          />
        </TextField>
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
            <Table.ScrollContainer>
              <Table.Content aria-label="Datos de la hoja">
                <Table.Header>
                  <Table.Column
                    isRowHeader
                    className="w-12 text-muted"
                  >
                    Fila
                  </Table.Column>
                  {table.headers.map((header, index) => (
                    <Table.Column key={index}>{header}</Table.Column>
                  ))}
                </Table.Header>
                <Table.Body>
                  {sampleRows.length === 0 ? (
                    <Table.Row>
                      <Table.Cell
                        colSpan={table.headers.length + 1}
                        className="text-center text-muted"
                      >
                        La tabla no tiene filas de datos
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    sampleRows.map((row) => (
                      <Table.Row key={row}>
                        <Table.Cell className="text-muted">
                          {row + 1}
                        </Table.Cell>
                        {tableRowCells(sheet.cells, table, row).map(
                          (cell, index) => (
                            <Table.Cell
                              key={index}
                              className={cn(
                                "max-w-48 truncate",
                                typeof cell === "number" &&
                                  "text-right tabular-nums"
                              )}
                            >
                              {cellText(cell)}
                            </Table.Cell>
                          )
                        )}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
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
        value={String(value) || null}
        onChange={(key) =>
          key != null && ((next) => onChange(Number(next)))(String(key))
        }
        fullWidth
      >
        <Select.Trigger id={id}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {columns.map((column) => (
              <ListBox.Item
                key={column}
                id={String(column)}
                textValue={String(columnName(column))}
              >
                {columnName(column)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  )
}
