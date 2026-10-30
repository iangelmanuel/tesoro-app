"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { FIELD_LABELS, MAX_ROWS } from "../constants"
import { type SourceTable, countDataRows, distinctValues } from "../normalize"
import type {
  DateFormat,
  ImportConfig,
  ImportField,
  TypeMode,
  TypeValueTarget
} from "../types"

const UNMAPPED = "none"

const TYPE_MODES: { value: TypeMode; label: string; hint: string }[] = [
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

/** Campos que se muestran según el modo de tipo, con los obligatorios */
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

const REQUIRED_FIELDS: Record<TypeMode, ImportField[]> = {
  column: ["date", "type", "amount"],
  sign: ["date", "amount"],
  split: ["date", "income_amount", "expense_amount"]
}

const OPTIONAL_HINTS: Partial<Record<ImportField, string>> = {
  category: "Sin columna, todo va a Otros ingresos u Otros gastos",
  description: "Si está vacía se usa el valor de la categoría",
  note: "Opcional"
}

interface ColumnsStepProps {
  headers: string[]
  config: ImportConfig
  tables: SourceTable[]
  onFieldChange: (field: ImportField, column: number | undefined) => void
  onTypeModeChange: (mode: TypeMode) => void
  onDateFormatChange: (format: DateFormat) => void
  onTypeValueChange: (key: string, target: TypeValueTarget | undefined) => void
  onBack: () => void
  onNext: () => void
}

// Paso 3: un select por campo con la sugerencia, modo de tipo, formato de
// fecha y mapeo de los valores de la columna de tipo
export function ColumnsStep({
  headers,
  config,
  tables,
  onFieldChange,
  onTypeModeChange,
  onDateFormatChange,
  onTypeValueChange,
  onBack,
  onNext
}: ColumnsStepProps) {
  const { mapping, typeMode, dateFormat, typeValues } = config

  const typeColumnValues = useMemo(
    () =>
      typeMode === "column" && mapping.type !== undefined
        ? distinctValues(tables, mapping.type)
        : [],
    [tables, typeMode, mapping.type]
  )
  const missing = REQUIRED_FIELDS[typeMode].filter(
    (field) => mapping[field] === undefined
  )
  const rowCount = useMemo(
    () => (missing.length === 0 ? countDataRows(tables, config) : 0),
    [tables, config, missing.length]
  )
  const tooManyRows = rowCount > MAX_ROWS

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p
          id="import-type-mode"
          className="text-sm font-medium"
        >
          ¿Cómo se sabe si es ingreso o gasto?
        </p>
        <RadioGroup
          aria-labelledby="import-type-mode"
          className="sm:grid-cols-3"
          value={typeMode}
          onValueChange={(value) => onTypeModeChange(value as TypeMode)}
        >
          {TYPE_MODES.map((mode) => (
            <Label
              key={mode.value}
              htmlFor={`import-type-mode-${mode.value}`}
              className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5"
            >
              <RadioGroupItem
                id={`import-type-mode-${mode.value}`}
                value={mode.value}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{mode.label}</span>
                <span className="text-muted-foreground">{mode.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Columnas</h2>
          <p className="text-sm text-muted-foreground">
            Revisa la sugerencia. Las columnas sin destino, como Método, se
            ignoran.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_FIELDS[typeMode].map((field) => {
            const required = REQUIRED_FIELDS[typeMode].includes(field)
            const id = `import-field-${field}`

            return (
              <div
                key={field}
                className="flex flex-col gap-1.5"
              >
                <Label htmlFor={id}>
                  {FIELD_LABELS[field]}
                  {required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={
                    mapping[field] === undefined
                      ? UNMAPPED
                      : String(mapping[field])
                  }
                  onValueChange={(value) =>
                    onFieldChange(
                      field,
                      value === UNMAPPED ? undefined : Number(value)
                    )
                  }
                >
                  <SelectTrigger
                    id={id}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED}>Sin mapear</SelectItem>
                    {headers.map((header, index) => (
                      <SelectItem
                        key={index}
                        value={String(index)}
                      >
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {OPTIONAL_HINTS[field] && (
                  <p className="text-xs text-muted-foreground">
                    {OPTIONAL_HINTS[field]}
                  </p>
                )}
              </div>
            )
          })}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-date-format">Formato de fecha</Label>
            <Select
              value={dateFormat}
              onValueChange={(value) => onDateFormatChange(value as DateFormat)}
            >
              <SelectTrigger
                id="import-date-format"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem
                    key={format.value}
                    value={format.value}
                  >
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Solo aplica a fechas escritas como texto
            </p>
          </div>
        </div>
      </section>

      {typeColumnValues.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">
              Valores de «{headers[mapping.type ?? 0]}»
            </h2>
            <p className="text-sm text-muted-foreground">
              Indica qué significa cada valor. Los que no asignes quedan con
              error «Tipo desconocido».
            </p>
          </div>
          <ul className="flex flex-col divide-y rounded-lg border">
            {typeColumnValues.map(({ key, label, count }) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">
                  {label || "(vacío)"}{" "}
                  <span className="text-muted-foreground">
                    · {count === 1 ? "1 fila" : `${count} filas`}
                  </span>
                </span>
                <Select
                  value={typeValues[key] ?? UNMAPPED}
                  onValueChange={(value) =>
                    onTypeValueChange(
                      key,
                      value === UNMAPPED
                        ? undefined
                        : (value as TypeValueTarget)
                    )
                  }
                >
                  <SelectTrigger
                    className="w-40"
                    aria-label={`Destino de ${label || "(vacío)"}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED}>Sin asignar</SelectItem>
                    {TYPE_VALUE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Falta mapear: {missing.map((field) => FIELD_LABELS[field]).join(", ")}
          .
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
          variant="outline"
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          disabled={missing.length > 0 || tooManyRows || rowCount === 0}
          onClick={onNext}
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}
