import { detectTables, suggestMapping, suggestTypeMode } from "../detect"
import { suggestDebtEntryValue } from "../normalize-debt-entries"
import { suggestGoalEntryValue } from "../normalize-goal-contributions"
import { suggestFrequencyValue } from "../normalize-recurring"
import {
  suggestAccountTargets,
  suggestCategoryTargets,
  suggestTypeValue
} from "../normalize-transactions"
import { distinctValues, suggestLinkTargets } from "../normalize-values"
import { DEFAULT_TARGET } from "../targets"
import type {
  DebtEntryTarget,
  GoalEntryTarget,
  ImportConfig,
  ImportTarget,
  PreviewRow
} from "../types"
import {
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  sourceTables
} from "./wizard-selectors"
import type {
  LoadedFile,
  PreviewState,
  WizardAction,
  WizardState
} from "./wizard-types"

// Reducer del asistente de importación (SPEC 08 y 08b). Los tipos están en
// wizard-types.ts y los datos derivados en wizard-selectors.ts.

/** Estado al abrir el asistente */
export const INITIAL_STATE: WizardState = {
  step: "file",
  target: DEFAULT_TARGET,
  file: null,
  selectedSheets: [],
  primaryTable: null,
  config: null,
  configHeaders: null,
  categoryTargets: {},
  accountTargets: {},
  linkTargets: {},
  preview: null,
  summary: null
}

/** Estado inicial con el destino de `?target=` */
export function initialState(target: ImportTarget): WizardState {
  return { ...INITIAL_STATE, target }
}

/** Agrega o quita el destino de un valor */
function withValue<T>(values: Record<string, T>, key: string, target?: T) {
  const next = { ...values }
  if (target === undefined) delete next[key]
  else next[key] = target
  return next
}

function firstTable(file: LoadedFile, sheet: string | undefined) {
  return sheet ? (file.detected[sheet]?.[0] ?? null) : null
}

/**
 * Agrega a `values` la sugerencia de cada valor nuevo de la columna. Los que
 * ya tienen destino no cambian.
 */
function seedColumnValues<T>(
  state: WizardState,
  column: number | undefined,
  values: Record<string, T>,
  suggest: (label: string) => T | undefined
) {
  if (column === undefined) return values

  const seeded = { ...values }
  for (const { key, label } of distinctValues(sourceTables(state), column)) {
    if (key in seeded) continue
    const suggestion = suggest(label)
    if (suggestion) seeded[key] = suggestion
  }
  return seeded
}

/**
 * Sugiere el destino de los valores nuevos de las columnas de tipo (ingreso o
 * gasto; pago, cargo, aporte o retiro) y de frecuencia
 */
function seedValues(state: WizardState, config: ImportConfig): ImportConfig {
  const { mapping } = config

  switch (state.target) {
    case "transactions":
      return {
        ...config,
        typeValues: seedColumnValues(
          state,
          mapping.type,
          config.typeValues,
          suggestTypeValue
        )
      }
    case "recurring_expenses":
      return {
        ...config,
        frequencyValues: seedColumnValues(
          state,
          mapping.frequency,
          config.frequencyValues,
          suggestFrequencyValue
        )
      }
    case "debt_entries":
    case "goal_contributions":
      return {
        ...config,
        entryTypeValues: seedColumnValues<DebtEntryTarget | GoalEntryTarget>(
          state,
          mapping.entry_type,
          config.entryTypeValues,
          state.target === "debt_entries"
            ? suggestDebtEntryValue
            : suggestGoalEntryValue
        )
      }
  }
}

/** Transiciones del asistente; cada acción devuelve un estado nuevo */
export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "set_target":
      if (action.target === state.target) return state
      return {
        ...state,
        target: action.target,
        config: null,
        configHeaders: null,
        categoryTargets: {},
        accountTargets: {},
        linkTargets: {},
        preview: null
      }

    case "file_loaded": {
      const detected = Object.fromEntries(
        action.sheets.map((sheet) => [
          sheet.name,
          detectTables(sheet.cells, sheet.name)
        ])
      )
      const file: LoadedFile = {
        name: action.name,
        isCsv: action.name.toLowerCase().endsWith(".csv"),
        sheets: action.sheets,
        detected
      }
      // Se marca la primera hoja con alguna tabla
      const first =
        action.sheets.find((sheet) => detected[sheet.name].length > 0) ??
        action.sheets[0]

      return {
        ...INITIAL_STATE,
        step: "table",
        target: state.target,
        file,
        selectedSheets: [first.name],
        primaryTable: firstTable(file, first.name)
      }
    }

    case "toggle_sheet": {
      if (!state.file) return state

      const selected = new Set(state.selectedSheets)
      if (selected.has(action.sheet)) selected.delete(action.sheet)
      else selected.add(action.sheet)

      const selectedSheets = state.file.sheets
        .map((sheet) => sheet.name)
        .filter((name) => selected.has(name))
      const primaryChanged = selectedSheets[0] !== state.selectedSheets[0]

      return {
        ...state,
        selectedSheets,
        primaryTable: primaryChanged
          ? firstTable(state.file, selectedSheets[0])
          : state.primaryTable
      }
    }

    case "set_primary_table":
      return { ...state, primaryTable: action.table }

    case "start_columns": {
      if (!state.primaryTable) return state

      const headers = state.primaryTable.headers.join("\u0000")
      if (state.config && state.configHeaders === headers) {
        return { ...state, step: "columns" }
      }

      const mapping = suggestMapping(state.primaryTable.headers, state.target)
      const config = seedValues(state, {
        mapping,
        typeMode: suggestTypeMode(mapping),
        dateFormat: "dmy",
        typeValues: {},
        entryTypeMode: mapping.entry_type === undefined ? "sign" : "column",
        entryTypeValues: {},
        frequencyValues: {},
        fixedLinkId: null
      })

      return {
        ...state,
        step: "columns",
        config,
        configHeaders: headers,
        categoryTargets: {},
        accountTargets: {},
        linkTargets: {}
      }
    }

    case "set_field": {
      if (!state.config) return state

      // Cada columna va a un solo campo
      const mapping = Object.fromEntries(
        Object.entries(state.config.mapping).filter(
          ([field, column]) =>
            field !== action.field && column !== action.column
        )
      )
      if (action.column !== undefined) mapping[action.field] = action.column

      return {
        ...state,
        config: seedValues(state, { ...state.config, mapping })
      }
    }

    case "set_type_mode":
      return state.config
        ? { ...state, config: { ...state.config, typeMode: action.mode } }
        : state

    case "set_date_format":
      return state.config
        ? { ...state, config: { ...state.config, dateFormat: action.format } }
        : state

    case "set_type_value": {
      if (!state.config) return state

      const typeValues = withValue(
        state.config.typeValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, typeValues } }
    }

    case "set_entry_type_mode":
      return state.config
        ? {
            ...state,
            config: seedValues(state, {
              ...state.config,
              entryTypeMode: action.mode
            })
          }
        : state

    case "set_entry_type_value": {
      if (!state.config) return state

      const entryTypeValues = withValue(
        state.config.entryTypeValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, entryTypeValues } }
    }

    case "set_frequency_value": {
      if (!state.config) return state

      const frequencyValues = withValue(
        state.config.frequencyValues,
        action.key,
        action.target
      )
      return { ...state, config: { ...state.config, frequencyValues } }
    }

    case "set_fixed_link":
      return state.config
        ? { ...state, config: { ...state.config, fixedLinkId: action.id } }
        : state

    case "start_categories": {
      if (!state.config) return state

      // Se conservan las elecciones de pares que ya se habían mapeado
      const extracted = extractForTarget(
        state.target,
        sourceTables(state),
        state.config
      )
      const suggested = suggestCategoryTargets(
        extractedPairs(extracted),
        action.categories
      )
      const suggestedAccounts = suggestAccountTargets(
        extractedAccountValues(extracted),
        action.accounts
      )

      return {
        ...state,
        step: "categories",
        categoryTargets: { ...suggested, ...state.categoryTargets },
        accountTargets: { ...suggestedAccounts, ...state.accountTargets }
      }
    }

    case "start_links": {
      if (!state.config) return state

      // Se conservan las elecciones de valores que ya se habían mapeado
      const extracted = extractForTarget(
        state.target,
        sourceTables(state),
        state.config
      )
      const suggested = suggestLinkTargets(
        extractedLinkValues(extracted),
        action.options
      )

      return {
        ...state,
        step: "categories",
        linkTargets: { ...suggested, ...state.linkTargets }
      }
    }

    case "set_link_target":
      return {
        ...state,
        linkTargets: { ...state.linkTargets, [action.key]: action.target }
      }

    case "set_category_target":
      return {
        ...state,
        categoryTargets: {
          ...state.categoryTargets,
          [action.key]: action.target
        }
      }

    case "set_account_target":
      return {
        ...state,
        accountTargets: {
          ...state.accountTargets,
          [action.key]: action.target
        }
      }

    case "preview_ready":
      return { ...state, step: "preview", preview: action.preview }

    case "toggle_row": {
      const row = state.preview?.rows[action.index]
      // Las filas con error u omitidas no se pueden marcar
      if (!state.preview || !row?.value) return state

      const rows: PreviewRow<unknown>[] = [...state.preview.rows]
      rows[action.index] = { ...row, selected: !row.selected }
      // Las filas siguen siendo del mismo destino
      return {
        ...state,
        preview: { ...state.preview, rows } as PreviewState
      }
    }

    case "imported":
      return { ...state, step: "summary", summary: action.stats }

    case "go_to":
      return { ...state, step: action.step }

    // "Importar otro archivo" conserva el destino
    case "reset":
      return { ...INITIAL_STATE, target: state.target }
  }
}
