import { FIELD_LABELS } from "../constants"
import { countDataRows } from "../normalize-transactions"
import { type SourceTable, readDataRows } from "../normalize-values"
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

// Paso 3 del asistente (SPEC 08 y 08b): opciones, campos visibles y
// obligatorios por destino y lo que falta para continuar. Lógica pura.

/** Una opción de modo (tipo o tipo de entrada) con su ayuda */
export interface ModeOption<T extends string> {
  value: T
  label: string
  hint: string
}

/** Cómo distinguir entradas y salidas */
export const TYPE_MODES: ModeOption<TypeMode>[] = [
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

/** Cómo distinguir pagos y cargos */
export const DEBT_ENTRY_MODES: ModeOption<EntryTypeMode>[] = [
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

/** Cómo distinguir aportes y retiros */
export const GOAL_ENTRY_MODES: ModeOption<EntryTypeMode>[] = [
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

/** Formatos de fecha de texto */
export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "dmy", label: "DD/MM/AAAA" },
  { value: "mdy", label: "MM/DD/AAAA" },
  { value: "ymd", label: "AAAA-MM-DD" }
]

/** Destinos de un valor de la columna de tipo */
export const TYPE_VALUE_OPTIONS: { value: TypeValueTarget; label: string }[] = [
  { value: "income", label: "Entrada" },
  { value: "expense", label: "Salida" },
  { value: "skip", label: "Omitir fila" }
]

/** Destinos de un valor de la columna de frecuencia */
export const FREQUENCY_VALUE_OPTIONS: {
  value: FrequencyTarget
  label: string
}[] = [
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
  { value: "skip", label: "Omitir fila" }
]

/** Destinos de un valor de tipo en deudas */
export const DEBT_ENTRY_VALUE_OPTIONS: {
  value: DebtEntryTarget
  label: string
}[] = [
  { value: "payment", label: "Pago" },
  { value: "charge", label: "Cargo (sube el saldo)" },
  { value: "decrease", label: "Ajuste que baja el saldo" },
  { value: "skip", label: "Omitir fila" }
]

/** Destinos de un valor de tipo en metas */
export const GOAL_ENTRY_VALUE_OPTIONS: {
  value: GoalEntryTarget
  label: string
}[] = [
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

/** Ayuda de los campos opcionales, por destino */
export const OPTIONAL_HINTS: Record<
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
export const LINK_FIELD: Partial<Record<ImportTarget, "debt" | "goal">> = {
  debt_entries: "debt",
  goal_contributions: "goal"
}

/** Campos visibles y obligatorios del destino con la configuración actual */
export function targetFields(target: ImportTarget, config: ImportConfig) {
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
export function missingItems(
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
export function countRows(
  target: ImportTarget,
  tables: SourceTable[],
  config: ImportConfig
) {
  if (target === "transactions") return countDataRows(tables, config)
  const fields: ImportField[] =
    target === "recurring_expenses" ? ["name", "amount"] : ["date", "amount"]
  return readDataRows(tables, config.mapping, fields).rows.length
}

/** Columna cuyos valores se mapean: tipo, frecuencia o tipo de entrada */
export function valueFieldFor(
  target: ImportTarget,
  config: Pick<ImportConfig, "typeMode" | "entryTypeMode">
): ImportField | null {
  if (target === "transactions") {
    return config.typeMode === "column" ? "type" : null
  }
  if (target === "recurring_expenses") return "frequency"
  return config.entryTypeMode === "column" ? "entry_type" : null
}
