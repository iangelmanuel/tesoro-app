"use client"

import { useMemo, useReducer, useState, useTransition } from "react"
import { getDuplicateCandidates } from "../actions"
import {
  debtResultingBalances,
  firstNegativeBalance,
  goalResultingBalances
} from "../balances"
import { confirmDebtEntriesImport } from "../debt-entry-import-actions"
import {
  dateRange,
  markDebtEntryDuplicates,
  markDuplicates,
  markGoalContributionDuplicates,
  markRecurringDuplicates
} from "../duplicates"
import { confirmGoalContributionsImport } from "../goal-contribution-import-actions"
import {
  buildDebtEntryPreviewRows,
  toDebtEntryImportRows
} from "../normalize-debt-entries"
import {
  buildGoalContributionPreviewRows,
  toGoalContributionImportRows
} from "../normalize-goal-contributions"
import { buildRecurringPreviewRows } from "../normalize-recurring"
import {
  buildPreviewRows,
  newAccounts,
  newCategories,
  toImportRows,
  toTransactionImportRows
} from "../normalize-transactions"
import { computeStats } from "../normalize-values"
import type { DebtLinkOption, GoalLinkOption } from "../queries"
import { confirmRecurringImport } from "../recurring-import-actions"
import { confirmImport } from "../transaction-import-actions"
import type {
  AccountOption,
  CategoryOption,
  ConfirmImportResult,
  ImportTarget
} from "../types"
import {
  accountNamesFor,
  hasLinkedPayments as anyLinkedPayment,
  categoryNamesFor,
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  linkedIds,
  selectedTables,
  toSourceTables
} from "./wizard-selectors"
import { initialState, wizardReducer } from "./wizard-state"
import type { PreviewState, StepId } from "./wizard-types"

interface UseImportWizardOptions {
  initialTarget: ImportTarget
  categories: CategoryOption[]
  accounts: AccountOption[]
  debts: DebtLinkOption[]
  goals: GoalLinkOption[]
}

/**
 * Estado del asistente de importación y lo que hace en el servidor: marcar
 * duplicados al armar la vista previa y guardar las filas marcadas
 */
export function useImportWizard({
  initialTarget,
  categories,
  accounts,
  debts,
  goals
}: UseImportWizardOptions) {
  // Sin deudas o metas activas, su destino no se puede elegir
  const unavailable = useMemo(() => {
    const targets: ImportTarget[] = []
    if (debts.length === 0) targets.push("debt_entries")
    if (goals.length === 0) targets.push("goal_contributions")
    return targets
  }, [debts.length, goals.length])
  const [state, dispatch] = useReducer(
    wizardReducer,
    unavailable.includes(initialTarget) ? "transactions" : initialTarget,
    initialState
  )
  // Casilla "Registrar también como gasto/ingreso" de deudas
  const [createTransactions, setCreateTransactions] = useState(false)
  const links = useMemo(
    () =>
      state.target === "debt_entries"
        ? debts
        : state.target === "goal_contributions"
          ? goals
          : [],
    [state.target, debts, goals]
  )
  // Solo se recalculan al cambiar el archivo, las hojas o la tabla, no al
  // marcar filas en la vista previa
  const { file, selectedSheets, primaryTable } = state
  const tables = useMemo(
    () => selectedTables({ file, selectedSheets, primaryTable }),
    [file, selectedSheets, primaryTable]
  )
  const sources = useMemo(() => toSourceTables(tables), [tables])
  const extracted = useMemo(
    () =>
      state.config
        ? extractForTarget(state.target, sources, state.config)
        : null,
    [state.target, sources, state.config]
  )
  const pairs = useMemo(() => extractedPairs(extracted), [extracted])
  const linkOptions = useMemo(() => extractedLinkValues(extracted), [extracted])
  const accountOptions = useMemo(
    () => extractedAccountValues(extracted),
    [extracted]
  )
  // Solo con la columna Método mapeada
  const { config, accountTargets, categoryTargets } = state
  const accountNames = useMemo(
    () => accountNamesFor({ config, accountTargets }, accounts),
    [accounts, config, accountTargets]
  )
  const categoryNames = useMemo(
    () => categoryNamesFor(categories, pairs, categoryTargets),
    [categories, pairs, categoryTargets]
  )
  const linkNames = useMemo(
    () => Object.fromEntries(links.map((link) => [link.id, link.name])),
    [links]
  )

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Arma las filas de la vista previa y marca duplicados contra la BD
  async function buildPreview(): Promise<PreviewState | string> {
    if (!extracted) return "No hay filas para importar"

    switch (extracted.target) {
      case "transactions": {
        const rows = buildPreviewRows(
          extracted.rows,
          state.categoryTargets,
          state.accountTargets
        )
        const range = dateRange(rows)
        if (!range)
          return { target: "transactions", rows, empty: extracted.empty }

        const result = await getDuplicateCandidates({
          target: "transactions",
          ...range
        })
        if (result.error !== undefined) return result.error
        return {
          target: "transactions",
          rows: markDuplicates(
            rows,
            result.target === "transactions" ? result.candidates : []
          ),
          empty: extracted.empty
        }
      }

      case "recurring_expenses": {
        const rows = buildRecurringPreviewRows(
          extracted.rows,
          state.categoryTargets
        )
        const result = await getDuplicateCandidates({
          target: "recurring_expenses"
        })
        if (result.error !== undefined) return result.error
        return {
          target: "recurring_expenses",
          rows: markRecurringDuplicates(
            rows,
            result.target === "recurring_expenses" ? result.candidates : []
          ),
          empty: extracted.empty
        }
      }

      case "debt_entries": {
        const rows = buildDebtEntryPreviewRows(
          extracted.rows,
          state.linkTargets,
          state.config?.fixedLinkId ?? null
        )
        const range = dateRange(rows)
        const ids = linkedIds(rows, (value) => value.debtId)
        if (!range || ids.length === 0) {
          return { target: "debt_entries", rows, empty: extracted.empty }
        }

        const result = await getDuplicateCandidates({
          target: "debt_entries",
          ...range,
          ids
        })
        if (result.error !== undefined) return result.error
        return {
          target: "debt_entries",
          rows: markDebtEntryDuplicates(
            rows,
            result.target === "debt_entries" ? result.candidates : []
          ),
          empty: extracted.empty
        }
      }

      case "goal_contributions": {
        const rows = buildGoalContributionPreviewRows(
          extracted.rows,
          state.linkTargets,
          state.config?.fixedLinkId ?? null
        )
        const range = dateRange(rows)
        const ids = linkedIds(rows, (value) => value.goalId)
        if (!range || ids.length === 0) {
          return { target: "goal_contributions", rows, empty: extracted.empty }
        }

        const result = await getDuplicateCandidates({
          target: "goal_contributions",
          ...range,
          ids
        })
        if (result.error !== undefined) return result.error
        return {
          target: "goal_contributions",
          rows: markGoalContributionDuplicates(
            rows,
            result.target === "goal_contributions" ? result.candidates : []
          ),
          empty: extracted.empty
        }
      }
    }
  }

  function showPreview() {
    setError(null)

    startTransition(async () => {
      const preview = await buildPreview()
      if (typeof preview === "string") {
        setError(preview)
        return
      }
      dispatch({ type: "preview_ready", preview })
    })
  }

  // Saldos resultantes y si algún pago marcado va a un préstamo o cuenta por
  // cobrar (solo ahí aplica la casilla de movimiento)
  const preview = state.preview
  const balances = useMemo(() => {
    if (preview?.target === "debt_entries") {
      return debtResultingBalances(preview.rows, debts)
    }
    if (preview?.target === "goal_contributions") {
      return goalResultingBalances(preview.rows, goals)
    }
    return []
  }, [preview, debts, goals])
  const negative = firstNegativeBalance(balances)
  const hasLinkedPayments = anyLinkedPayment(preview, debts)

  // Guarda las filas marcadas con la acción del destino
  function save(preview: PreviewState): Promise<ConfirmImportResult> {
    const stats = computeStats(preview.rows, preview.empty)
    const base = {
      filename: state.file?.name ?? "",
      sheets: state.file?.isCsv
        ? []
        : sources.map((source) => source.table.sheet),
      stats
    }

    switch (preview.target) {
      case "transactions":
        return confirmImport({
          ...base,
          newCategories: newCategories(
            preview.rows,
            state.categoryTargets,
            pairs
          ),
          newAccounts: newAccounts(preview.rows, state.accountTargets),
          rows: toTransactionImportRows(preview.rows)
        })
      case "recurring_expenses":
        return confirmRecurringImport({
          ...base,
          newCategories: newCategories(
            preview.rows,
            state.categoryTargets,
            pairs
          ).map(({ key, name }) => ({ key, name })),
          rows: toImportRows(preview.rows)
        })
      case "debt_entries":
        return confirmDebtEntriesImport({
          ...base,
          createTransactions: createTransactions && hasLinkedPayments,
          rows: toDebtEntryImportRows(preview.rows)
        })
      case "goal_contributions":
        return confirmGoalContributionsImport({
          ...base,
          rows: toGoalContributionImportRows(preview.rows)
        })
    }
  }

  function confirm() {
    const { preview } = state
    if (!state.file || !preview) return
    setError(null)

    startTransition(async () => {
      const result = await save(preview)

      if (result.error !== undefined) {
        setError(result.error)
        return
      }

      dispatch({
        type: "imported",
        stats: computeStats(preview.rows, preview.empty)
      })
    })
  }

  function goTo(step: StepId) {
    setError(null)
    dispatch({ type: "go_to", step })
  }

  return {
    state,
    dispatch,
    unavailable,
    links,
    tables,
    sources,
    pairs,
    linkOptions,
    accountOptions,
    accountNames,
    categoryNames,
    linkNames,
    pending,
    error,
    setError,
    createTransactions,
    setCreateTransactions,
    balances,
    negative,
    hasLinkedPayments,
    showPreview,
    confirm,
    goTo
  }
}
