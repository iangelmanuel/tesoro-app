"use client"

import { useMemo } from "react"
import {
  Button,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select
} from "@heroui/react"
import { FIELD_LABELS, MAX_ROWS } from "../constants"
import {
  type SourceTable,
  countDataRows,
  distinctValues,
  readDataRows
} from "../normalize"
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
    hint: "Una columna dice si es ingreso o gasto (p. ej. Entrada / Salida)"
  },
  {
    value: "sign",
    label: "Signo del monto",
    hint: "Los montos negativos son gastos y los positivos, ingresos"
  },
  {
    value: "split",
    label: "Dos columnas",
    hint: "Una columna para ingresos y otra para gastos"
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
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
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
  { value: "decrease", label: "Ajuste a la baja" },
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
          title="¿Cómo se sabe si es ingreso o gasto?"
          options={TYPE_MODES}
          value={typeMode}
          onChange={onTypeModeChange}
        />
      )}
      {linkField && (
        <ModeRadio
          id="import-entry-mode"
          title={
            linkField === "debt"
              ? "¿Cómo se sabe si es pago o cargo?"
              : "¿Cómo se sabe si es aporte o retiro?"
          }
          options={linkField === "debt" ? DEBT_ENTRY_MODES : GOAL_ENTRY_MODES}
          value={entryTypeMode}
          onChange={onEntryTypeModeChange}
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Columnas</h2>
          <p className="text-sm text-muted">
            {target === "transactions"
              ? "Revisa la sugerencia. Las columnas sin destino, como Método, se ignoran."
              : "Revisa la sugerencia. Las columnas sin destino se ignoran."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const id = `import-field-${field}`
            const hint = OPTIONAL_HINTS[target][field]

            return (
              <div
                key={field}
                className="flex flex-col gap-1.5"
              >
                <Label htmlFor={id}>
                  {FIELD_LABELS[field]}
                  {required.includes(field) && (
                    <span className="text-danger">*</span>
                  )}
                </Label>
                <Select
                  value={
                    (mapping[field] === undefined
                      ? UNMAPPED
                      : String(mapping[field])) || null
                  }
                  onChange={(key) =>
                    key != null &&
                    ((value) =>
                      onFieldChange(
                        field,
                        value === UNMAPPED ? undefined : Number(value)
                      ))(String(key))
                  }
                  fullWidth
                >
                  <Select.Trigger id={id}>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item
                        id={UNMAPPED}
                        textValue="Sin mapear"
                      >
                        Sin mapear
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {headers.map((header, index) => (
                        <ListBox.Item
                          key={index}
                          id={String(index)}
                          textValue={String(header)}
                        >
                          {header}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                {hint && <p className="text-xs text-muted">{hint}</p>}
              </div>
            )
          })}

          {linkField && mapping[linkField] === undefined && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-fixed-link">
                {linkField === "debt"
                  ? "Deuda para todo el archivo"
                  : "Meta para todo el archivo"}
                <span className="text-danger">*</span>
              </Label>
              <Select
                value={(config.fixedLinkId ?? UNMAPPED) || null}
                onChange={(key) =>
                  key != null &&
                  ((value) =>
                    onFixedLinkChange(value === UNMAPPED ? null : value))(
                    String(key)
                  )
                }
                fullWidth
              >
                <Select.Trigger id="import-fixed-link">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item
                      id={UNMAPPED}
                      textValue={String(
                        linkField === "debt"
                          ? "Elige una deuda"
                          : "Elige una meta"
                      )}
                    >
                      {linkField === "debt"
                        ? "Elige una deuda"
                        : "Elige una meta"}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {links.map((link) => (
                      <ListBox.Item
                        key={link.id}
                        id={link.id}
                        textValue={String(link.name)}
                      >
                        {link.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-date-format">Formato de fecha</Label>
            <Select
              value={dateFormat || null}
              onChange={(key) =>
                key != null &&
                ((value) => onDateFormatChange(value as DateFormat))(
                  String(key)
                )
              }
              fullWidth
            >
              <Select.Trigger id="import-date-format">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {DATE_FORMATS.map((format) => (
                    <ListBox.Item
                      key={format.value}
                      id={format.value}
                      textValue={String(format.label)}
                    >
                      {format.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <p className="text-xs text-muted">
              Solo aplica a fechas escritas como texto
            </p>
          </div>
        </div>
      </section>

      {valueColumn !== undefined && columnValues.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">
              Valores de «{headers[valueColumn]}»
            </h2>
            <p className="text-sm text-muted">
              Indica qué significa cada valor. Los que no asignes quedan con
              error «
              {valueField === "frequency"
                ? "Frecuencia desconocida"
                : "Tipo desconocido"}
              ».
            </p>
          </div>
          <ul className="flex flex-col divide-y rounded-lg border">
            {columnValues.map(({ key, label, count }) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">
                  {label || "(vacío)"}{" "}
                  <span className="text-muted">
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
        <p className="text-sm text-muted">
          Falta mapear: {missing.join(", ")}.
        </p>
      )}
      {tooManyRows && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          Máximo 2.000 filas por importación. Las hojas elegidas tienen{" "}
          {rowCount.toLocaleString("es-CO")} filas con datos: desmarca alguna
          hoja.
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onPress={onBack}
        >
          Atrás
        </Button>
        <Button
          isDisabled={missing.length > 0 || tooManyRows || rowCount === 0}
          onPress={onNext}
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
  options: ModeOption<T>[]
  value: T
  onChange: (value: T) => void
}

function ModeRadio<T extends string>({
  id,
  title,
  options,
  value,
  onChange
}: ModeRadioProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <p
        id={id}
        className="text-sm font-medium"
      >
        {title}
      </p>
      <RadioGroup
        aria-labelledby={id}
        className="grid gap-3 sm:grid-cols-3"
        value={value}
        onChange={(next) => onChange(next as T)}
      >
        {options.map((mode) => (
          <Radio
            key={mode.value}
            value={mode.value}
          >
            {({ isSelected }) => (
              <Radio.Content
                className="flex h-full w-full cursor-pointer items-start gap-2 rounded-xl border border-border p-3 transition-colors data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
                data-selected={isSelected}
              >
                <Radio.Control className="mt-0.5">
                  <Radio.Indicator />
                </Radio.Control>
                <span className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-muted">{mode.hint}</span>
                </span>
              </Radio.Content>
            )}
          </Radio>
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
    <Select
      value={(value ?? UNMAPPED) || null}
      onChange={(key) =>
        key != null &&
        ((next) => onChange(next === UNMAPPED ? undefined : (next as T)))(
          String(key)
        )
      }
      className="w-48"
      aria-label={`Destino de ${label || "(vacío)"}`}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item
            id={UNMAPPED}
            textValue="Sin asignar"
          >
            Sin asignar
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={String(option.label)}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
