"use client"

import { useMemo } from "react"
import { CARD_LIST } from "@/components/dashboard/data/surface"
import { FieldHelp } from "@/components/forms/field-label"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { RadioGroup } from "@/components/ui/radio-group"
import type { FieldHelpKey } from "@/config/help"
import { cn } from "@/libs/cn"
import { FIELD_LABELS, MAX_ROWS } from "../constants"
import { countDataRows } from "../normalize-transactions"
import {
  type SourceTable,
  distinctValues,
  readDataRows
} from "../normalize-values"
import { IMPORT_TARGETS } from "../targets"
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
import { RadioCard } from "./radio-card"
import { RowTargetSelect } from "./row-target-select"

const UNMAPPED = "none"

interface ModeOption<T extends string> {
  value: T
  label: string
  hint: string
}

const TYPE_MODES: ModeOption<TypeMode>[] = [
  {
    value: "column",
    label: "Columna con valores",
    hint: "Una columna dice si es entrada o salida (p. ej. Crédito / Débito)"
  },
  {
    value: "sign",
    label: "Signo del monto",
    hint: "Los montos negativos son salidas y los positivos, entradas"
  },
  {
    value: "split",
    label: "Dos columnas",
    hint: "Una columna para entradas y otra para salidas"
  }
]

const DEBT_ENTRY_MODES: ModeOption<EntryTypeMode>[] = [
  {
    value: "column",
    label: "Columna con valores",
    hint: "Una columna dice si es pago, cargo o ajuste"
  },
  {
    value: "sign",
    label: "Signo del monto",
    hint: "Los negativos son pagos y los positivos, cargos que suben el saldo"
  },
  {
    value: "all",
    label: "Todas son pagos",
    hint: "El archivo solo trae pagos"
  }
]

const GOAL_ENTRY_MODES: ModeOption<EntryTypeMode>[] = [
  {
    value: "column",
    label: "Columna con valores",
    hint: "Una columna dice si es aporte o retiro"
  },
  {
    value: "sign",
    label: "Signo del monto",
    hint: "Los negativos son retiros y los positivos, aportes"
  },
  {
    value: "all",
    label: "Todos son aportes",
    hint: "El archivo solo trae aportes"
  }
]

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "dmy", label: "DD/MM/AAAA" },
  { value: "mdy", label: "MM/DD/AAAA" },
  { value: "ymd", label: "AAAA-MM-DD" }
]

const TYPE_VALUE_OPTIONS: { value: TypeValueTarget; label: string }[] = [
  { value: "income", label: "Entrada" },
  { value: "expense", label: "Salida" },
  { value: "skip", label: "Omitir fila" }
]

const FREQUENCY_VALUE_OPTIONS: { value: FrequencyTarget; label: string }[] = [
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
  { value: "skip", label: "Omitir fila" }
]

const DEBT_ENTRY_VALUE_OPTIONS: { value: DebtEntryTarget; label: string }[] = [
  { value: "payment", label: "Pago" },
  { value: "charge", label: "Cargo (sube el saldo)" },
  { value: "decrease", label: "Ajuste que baja el saldo" },
  { value: "skip", label: "Omitir fila" }
]

const GOAL_ENTRY_VALUE_OPTIONS: { value: GoalEntryTarget; label: string }[] = [
  { value: "contribution", label: "Aporte" },
  { value: "withdrawal", label: "Retiro" },
  { value: "skip", label: "Omitir fila" }
]

/** Movimientos: campos que se muestran según el modo de tipo */
const MODE_FIELDS: Record<TypeMode, ImportField[]> = {
  column: ["date", "type", "amount", "category", "description", "note"],
  sign: ["date", "amount", "category", "description", "note"],
  split: [
    "date",
    "income_amount",
    "expense_amount",
    "category",
    "description",
    "note"
  ]
}

/** Movimientos: campos obligatorios según el modo de tipo */
const REQUIRED_FIELDS: Record<TypeMode, ImportField[]> = {
  column: ["date", "type", "amount"],
  sign: ["date", "amount"],
  split: ["date", "income_amount", "expense_amount"]
}

const OPTIONAL_HINTS: Record<
  ImportTarget,
  Partial<Record<ImportField, string>>
> = {
  transactions: {
    category: "Sin columna, todo va a Otros ingresos u Otros gastos",
    description: "Si está vacía se usa el valor de la categoría",
    note: "Opcional",
    account: "Método de pago. Sin columna, los movimientos quedan sin cuenta"
  },
  recurring_expenses: {
    category: "Sin columna, todos van a Otros gastos",
    frequency: "Sin columna, todos son mensuales",
    day_of_month: "Este o Inicio. Sin columna, el día de la fecha de inicio",
    month_of_year: "Solo anuales. Sin columna, el mes de la fecha de inicio",
    starts_on: "Este o Día. Sin columna, el primer día del mes actual",
    ends_on: "Opcional"
  },
  debt_entries: {
    debt: "Sin columna, eliges una deuda para todo el archivo",
    note: "Opcional"
  },
  goal_contributions: {
    goal: "Sin columna, eliges una meta para todo el archivo",
    note: "Opcional"
  }
}

/** Campo de deuda o meta del destino */
const LINK_FIELD: Partial<Record<ImportTarget, "debt" | "goal">> = {
  debt_entries: "debt",
  goal_contributions: "goal"
}

/** Campos visibles y obligatorios del destino con la configuración actual */
function targetFields(target: ImportTarget, config: ImportConfig) {
  if (target === "transactions") {
    return {
      fields: MODE_FIELDS[config.typeMode],
      required: REQUIRED_FIELDS[config.typeMode]
    }
  }
  if (target === "recurring_expenses") {
    return {
      fields: [...IMPORT_TARGETS.recurring_expenses.fields],
      required: ["name", "amount"] satisfies ImportField[]
    }
  }

  const byColumn = config.entryTypeMode === "column"
  return {
    fields: IMPORT_TARGETS[target].fields.filter(
      (field) => field !== "entry_type" || byColumn
    ),
    required: [
      "date",
      "amount",
      ...(byColumn ? ["entry_type" as const] : [])
    ] satisfies ImportField[]
  }
}

/** Lo que falta para continuar, como texto */
function missingItems(
  target: ImportTarget,
  config: ImportConfig,
  required: ImportField[]
) {
  const { mapping } = config
  const missing = required
    .filter((field) => mapping[field] === undefined)
    .map((field) => FIELD_LABELS[field])

  if (
    target === "recurring_expenses" &&
    mapping.day_of_month === undefined &&
    mapping.starts_on === undefined
  ) {
    missing.push("Día o Inicio")
  }

  const linkField = LINK_FIELD[target]
  if (linkField && mapping[linkField] === undefined && !config.fixedLinkId) {
    missing.push(
      linkField === "debt"
        ? "la columna Deuda o una deuda para todo el archivo"
        : "la columna Meta o una meta para todo el archivo"
    )
  }

  return missing
}

/** Filas con datos: transacciones con su regla; el resto, sin vacías */
function countRows(
  target: ImportTarget,
  tables: SourceTable[],
  config: ImportConfig
) {
  if (target === "transactions") return countDataRows(tables, config)
  const fields: ImportField[] =
    target === "recurring_expenses" ? ["name", "amount"] : ["date", "amount"]
  return readDataRows(tables, config.mapping, fields).rows.length
}

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
  const valueField: ImportField | null =
    target === "transactions"
      ? typeMode === "column"
        ? "type"
        : null
      : target === "recurring_expenses"
        ? "frequency"
        : entryTypeMode === "column"
          ? "entry_type"
          : null
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

interface ModeRadioProps<T extends string> {
  id: string
  title: string
  help: FieldHelpKey
  options: ModeOption<T>[]
  value: T
  onChange: (value: T) => void
}

function ModeRadio<T extends string>({
  id,
  title,
  help,
  options,
  value,
  onChange
}: ModeRadioProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5">
        <p
          id={id}
          className="text-sm font-medium"
        >
          {title}
        </p>
        <FieldHelp
          help={help}
          label={title}
        />
      </div>
      <RadioGroup
        aria-labelledby={id}
        className="grid gap-3 sm:grid-cols-3"
        value={value}
        onValueChange={(next) => onChange(next as T)}
      >
        {options.map((mode) => (
          <RadioCard
            key={mode.value}
            id={`${id}-${mode.value}`}
            value={mode.value}
            label={mode.label}
            hint={
              <span
                id={`${id}-${mode.value}-hint`}
                className="text-muted-foreground"
              >
                {mode.hint}
              </span>
            }
          />
        ))}
      </RadioGroup>
    </div>
  )
}

interface ValueSelectProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T | undefined) => void
}

function ValueSelect<T extends string>({
  label,
  options,
  value,
  onChange
}: ValueSelectProps<T>) {
  return (
    <RowTargetSelect
      aria-label={`Destino de ${label || "(vacío)"}`}
      value={value ?? UNMAPPED}
      onChange={(next) => onChange(next === UNMAPPED ? undefined : (next as T))}
      groups={[
        { options: [{ value: UNMAPPED, label: "Sin asignar" }] },
        { options }
      ]}
    />
  )
}
