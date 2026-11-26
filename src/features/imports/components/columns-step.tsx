"use client"

import { useMemo } from "react"
import { CARD_LIST } from "@/components/dashboard/data/surface"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/cn"
import { FIELD_LABELS, MAX_ROWS } from "../constants"
import { type SourceTable, distinctValues } from "../normalize-values"
import type {
  DateFormat,
  DebtEntryTarget,
  EntryTypeMode,
  FrequencyTarget,
  GoalEntryTarget,
  ImportConfig,
  ImportField,
  ImportTarget,
  TypeMode,
  TypeValueTarget
} from "../types"
import { ModeRadio, UNMAPPED, ValueSelect } from "./columns-controls"
import {
  DATE_FORMATS,
  DEBT_ENTRY_MODES,
  DEBT_ENTRY_VALUE_OPTIONS,
  FREQUENCY_VALUE_OPTIONS,
  GOAL_ENTRY_MODES,
  GOAL_ENTRY_VALUE_OPTIONS,
  LINK_FIELD,
  OPTIONAL_HINTS,
  TYPE_MODES,
  TYPE_VALUE_OPTIONS,
  countRows,
  missingItems,
  targetFields,
  valueFieldFor
} from "./columns-options"

interface ColumnsStepProps {
  target: ImportTarget
  headers: string[]
  config: ImportConfig
  tables: SourceTable[]
  /** Deudas o metas activas, para el destino fijo */
  links: { id: string; name: string }[]
  onFieldChange: (field: ImportField, column: number | undefined) => void
  onTypeModeChange: (mode: TypeMode) => void
  onEntryTypeModeChange: (mode: EntryTypeMode) => void
  onDateFormatChange: (format: DateFormat) => void
  onTypeValueChange: (key: string, target: TypeValueTarget | undefined) => void
  onEntryTypeValueChange: (
    key: string,
    target: DebtEntryTarget | GoalEntryTarget | undefined
  ) => void
  onFrequencyValueChange: (
    key: string,
    target: FrequencyTarget | undefined
  ) => void
  onFixedLinkChange: (id: string | null) => void
  onBack: () => void
  onNext: () => void
}

// Paso 3: un select por campo con la sugerencia, modo de tipo, formato de
// fecha y mapeo de los valores de la columna de tipo o de frecuencia, según
// el destino
export function ColumnsStep({
  target,
  headers,
  config,
  tables,
  links,
  onFieldChange,
  onTypeModeChange,
  onEntryTypeModeChange,
  onDateFormatChange,
  onTypeValueChange,
  onEntryTypeValueChange,
  onFrequencyValueChange,
  onFixedLinkChange,
  onBack,
  onNext
}: ColumnsStepProps) {
  const { mapping, typeMode, entryTypeMode, dateFormat } = config
  const { fields, required } = targetFields(target, config)
  const linkField = LINK_FIELD[target]

  // Columna cuyos valores se mapean: tipo, frecuencia o tipo de entrada
  const valueField = valueFieldFor(target, config)
  const valueColumn = valueField === null ? undefined : mapping[valueField]

  const columnValues = useMemo(
    () =>
      valueColumn === undefined ? [] : distinctValues(tables, valueColumn),
    [tables, valueColumn]
  )
  const missing = missingItems(target, config, required)
  const complete = missing.length === 0
  const rowCount = useMemo(
    () => (complete ? countRows(target, tables, config) : 0),
    [target, tables, config, complete]
  )
  const tooManyRows = rowCount > MAX_ROWS

  return (
    <div className="flex flex-col gap-6">
      {target === "transactions" && (
        <ModeRadio
          id="import-type-mode"
          help="import.amountSign"
          title="Cómo distinguir entradas y salidas"
          options={TYPE_MODES}
          value={typeMode}
          onChange={onTypeModeChange}
        />
      )}
      {linkField && (
        <ModeRadio
          id="import-entry-mode"
          help="import.entryMode"
          title={
            linkField === "debt"
              ? "Cómo distinguir pagos y cargos"
              : "Cómo distinguir aportes y retiros"
          }
          options={linkField === "debt" ? DEBT_ENTRY_MODES : GOAL_ENTRY_MODES}
          value={entryTypeMode}
          onChange={onEntryTypeModeChange}
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Columnas</h2>
          <p className="text-sm text-muted-foreground">
            {target === "transactions"
              ? "Revisa la sugerencia. Las columnas sin destino, como Método, se ignoran."
              : "Revisa la sugerencia. Las columnas sin destino se ignoran."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const hint = OPTIONAL_HINTS[target][field]

            return (
              <SelectField
                key={field}
                label={FIELD_LABELS[field]}
                help="import.column"
                isRequired={required.includes(field)}
                value={
                  mapping[field] === undefined
                    ? UNMAPPED
                    : String(mapping[field])
                }
                onChange={(value) =>
                  onFieldChange(
                    field,
                    value === UNMAPPED ? undefined : Number(value)
                  )
                }
                options={[
                  { value: UNMAPPED, label: "Sin mapear" },
                  ...headers.map((header, index) => ({
                    value: String(index),
                    label: String(header)
                  }))
                ]}
                description={hint}
              />
            )
          })}

          {linkField && mapping[linkField] === undefined && (
            <SelectField
              label={
                linkField === "debt"
                  ? "Deuda para todo el archivo"
                  : "Meta para todo el archivo"
              }
              help="import.fixedLink"
              isRequired
              value={config.fixedLinkId ?? UNMAPPED}
              onChange={(value) =>
                onFixedLinkChange(value === UNMAPPED ? null : value)
              }
              options={[
                {
                  value: UNMAPPED,
                  label:
                    linkField === "debt" ? "Elige una deuda" : "Elige una meta"
                },
                ...links.map((link) => ({ value: link.id, label: link.name }))
              ]}
            />
          )}

          <SelectField
            label="Formato de fecha"
            help="import.dateFormat"
            value={dateFormat}
            onChange={(value) => onDateFormatChange(value as DateFormat)}
            options={DATE_FORMATS.map((format) => ({
              value: format.value,
              label: format.label
            }))}
            description="Solo aplica a fechas escritas como texto"
          />
        </div>
      </section>

      {valueColumn !== undefined && columnValues.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">
              Valores de «{headers[valueColumn]}»
            </h2>
            <p className="text-sm text-muted-foreground">
              Indica qué significa cada valor. Los que no asignes quedan con
              error «
              {valueField === "frequency"
                ? "Frecuencia desconocida"
                : "Tipo desconocido"}
              ».
            </p>
          </div>
          <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
            {columnValues.map(({ key, label, count }) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="text-sm">
                  {label || "(vacío)"}{" "}
                  <span className="text-muted-foreground">
                    · {count === 1 ? "1 fila" : `${count} filas`}
                  </span>
                </span>
                {target === "transactions" ? (
                  <ValueSelect
                    label={label}
                    options={TYPE_VALUE_OPTIONS}
                    value={config.typeValues[key]}
                    onChange={(value) => onTypeValueChange(key, value)}
                  />
                ) : target === "recurring_expenses" ? (
                  <ValueSelect
                    label={label}
                    options={FREQUENCY_VALUE_OPTIONS}
                    value={config.frequencyValues[key]}
                    onChange={(value) => onFrequencyValueChange(key, value)}
                  />
                ) : (
                  <ValueSelect<DebtEntryTarget | GoalEntryTarget>
                    label={label}
                    options={
                      target === "debt_entries"
                        ? DEBT_ENTRY_VALUE_OPTIONS
                        : GOAL_ENTRY_VALUE_OPTIONS
                    }
                    value={config.entryTypeValues[key]}
                    onChange={(value) => onEntryTypeValueChange(key, value)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Falta mapear: {missing.join(", ")}.
        </p>
      )}
      {tooManyRows && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          Máximo 2.000 filas por importación. Las hojas elegidas tienen{" "}
          {rowCount.toLocaleString("es-CO")} filas con datos: desmarca alguna
          hoja.
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          type="button"
          disabled={missing.length > 0 || tooManyRows || rowCount === 0}
          onClick={onNext}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}
