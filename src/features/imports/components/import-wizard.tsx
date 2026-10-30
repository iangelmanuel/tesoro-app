"use client"

import { useMemo, useReducer, useState, useTransition } from "react"
import { Check } from "lucide-react"
import { formatCurrency } from "@/libs/format"
import { cn } from "@/libs/utils"
import {
  type ConfirmImportResult,
  confirmDebtEntriesImport,
  confirmGoalContributionsImport,
  confirmImport,
  confirmRecurringImport,
  getDuplicateCandidates
} from "../actions"
import {
  debtResultingBalances,
  firstNegativeBalance,
  goalResultingBalances
} from "../balances"
import {
  dateRange,
  markDebtEntryDuplicates,
  markDuplicates,
  markGoalContributionDuplicates,
  markRecurringDuplicates
} from "../duplicates"
import {
  buildPreviewRows,
  computeStats,
  existingAccountKey,
  existingCategoryKey,
  newAccountKey,
  newAccounts,
  newCategories,
  newCategoryKey,
  toImportRows,
  toTransactionImportRows
} from "../normalize"
import { buildDebtEntryPreviewRows } from "../normalize-debt-entries"
import { buildGoalContributionPreviewRows } from "../normalize-goal-contributions"
import { buildRecurringPreviewRows } from "../normalize-recurring"
import type { DebtLinkOption, GoalLinkOption } from "../queries"
import { countLabel } from "../targets"
import type { AccountOption, CategoryOption, ImportTarget } from "../types"
import { CategoriesStep } from "./categories-step"
import { ColumnsStep } from "./columns-step"
import { FileStep } from "./file-step"
import { LinkStep } from "./link-step"
import {
  Balances,
  CreateTransactionsField,
  PreviewStep,
  debtEntryColumns,
  goalContributionColumns,
  recurringColumns,
  transactionColumns
} from "./preview-step"
import { SummaryStep } from "./summary-step"
import { TableStep } from "./table-step"
import {
  type PreviewState,
  STEPS,
  type StepId,
  extractForTarget,
  extractedAccountValues,
  extractedLinkValues,
  extractedPairs,
  initialState,
  selectedTables,
  stepLabel,
  toSourceTables,
  wizardReducer
} from "./wizard-state"

// Asistente de 6 pasos: archivo → tabla → columnas → categorías (o deudas o
// metas) → vista previa → resumen. El estado vive en el cliente y se pierde
// al recargar.
interface ImportWizardProps {
  /** Destino de `?target=` */
  initialTarget: ImportTarget
  /** Categorías activas (sistema y propias) para el paso de categorías */
  categories: CategoryOption[]
  /** Cuentas activas para la columna Método (movimientos) */
  accounts: AccountOption[]
  /** Deudas y metas activas: destinos de esas importaciones */
  debts: DebtLinkOption[]
  goals: GoalLinkOption[]
  currency: string
}

/** Ids distintos de deudas o metas de las filas con datos */
function linkedIds<V>(rows: { value?: V }[], idOf: (value: V) => string) {
  return [
    ...new Set(rows.flatMap((row) => (row.value ? [idOf(row.value)] : [])))
  ]
}

export function ImportWizard({
  initialTarget,
  categories,
  accounts,
  debts,
  goals,
  currency
}: ImportWizardProps) {
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
  const accountNames = useMemo(() => {
    if (state.config?.mapping.account === undefined) return undefined
    const names: Record<string, string> = {}
    for (const account of accounts) {
      names[existingAccountKey(account.id)] = account.name
    }
    for (const target of Object.values(state.accountTargets)) {
      if (target.kind === "new") {
        names[newAccountKey(target.name)] = `${target.name} (nueva)`
      }
    }
    return names
  }, [accounts, state.config?.mapping.account, state.accountTargets])
  const categoryNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const category of categories) {
      names[existingCategoryKey(category.id)] = category.name
    }
    for (const pair of pairs) {
      const target = state.categoryTargets[pair.key]
      if (target?.kind === "new") {
        names[newCategoryKey(pair.type, target.name)] = `${target.name} (nueva)`
      }
    }
    return names
  }, [categories, pairs, state.categoryTargets])
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
          rows: preview.rows.flatMap(({ selected, value }) =>
            selected && value
              ? [
                  {
                    debt_id: value.debtId,
                    kind: value.kind,
                    amount: value.amount,
                    occurred_on: value.occurred_on,
                    note: value.note
                  }
                ]
              : []
          )
        })
      case "goal_contributions":
        return confirmGoalContributionsImport({
          ...base,
          rows: preview.rows.flatMap(({ selected, value }) =>
            selected && value
              ? [
                  {
                    goal_id: value.goalId,
                    amount: value.amount,
                    occurred_on: value.occurred_on,
                    note: value.note
                  }
                ]
              : []
          )
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
  const hasLinkedPayments =
    preview?.target === "debt_entries" &&
    preview.rows.some(
      ({ selected, value }) =>
        selected &&
        value?.kind === "payment" &&
        debts.find((debt) => debt.id === value.debtId)?.kind !== "credit_card"
    )

  function renderPreview(preview: PreviewState) {
    const common = {
      empty: preview.empty,
      countLabel: (count: number) => countLabel(preview.target, count),
      importing: pending,
      error,
      onToggle: (index: number) => dispatch({ type: "toggle_row", index }),
      onBack: () =>
        goTo(
          (preview.target === "debt_entries" ||
            preview.target === "goal_contributions") &&
            state.config?.mapping[
              preview.target === "debt_entries" ? "debt" : "goal"
            ] === undefined
            ? "columns"
            : "categories"
        ),
      onConfirm: confirm
    }
    const blocked = negative
      ? `El saldo de «${negative.name}» quedaría en ${formatCurrency(negative.result, currency)}`
      : null

    switch (preview.target) {
      case "transactions":
        return (
          <PreviewStep
            {...common}
            rows={preview.rows}
            columns={transactionColumns(currency, categoryNames, accountNames)}
          />
        )
      case "recurring_expenses":
        return (
          <PreviewStep
            {...common}
            rows={preview.rows}
            columns={recurringColumns(currency, categoryNames)}
          />
        )
      case "debt_entries":
        return (
          <PreviewStep
            {...common}
            rows={preview.rows}
            columns={debtEntryColumns(currency, linkNames)}
            blocked={blocked}
            extra={
              <>
                <Balances
                  title="Saldos de tus deudas"
                  balances={balances}
                  currency={currency}
                />
                {hasLinkedPayments && (
                  <CreateTransactionsField
                    checked={createTransactions}
                    disabled={pending}
                    onChange={setCreateTransactions}
                  />
                )}
              </>
            }
          />
        )
      case "goal_contributions":
        return (
          <PreviewStep
            {...common}
            rows={preview.rows}
            columns={goalContributionColumns(currency, linkNames)}
            blocked={blocked}
            extra={
              <Balances
                title="Ahorrado en tus metas"
                balances={balances}
                currency={currency}
              />
            }
          />
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border p-4 sm:p-6">
      <StepIndicator
        current={state.step}
        target={state.target}
      />

      {state.step === "file" && (
        <FileStep
          target={state.target}
          unavailable={unavailable}
          onTargetChange={(target) => {
            setCreateTransactions(false)
            dispatch({ type: "set_target", target })
          }}
          onLoaded={(name, sheets) =>
            dispatch({ type: "file_loaded", name, sheets })
          }
        />
      )}

      {state.step === "table" && state.file && (
        <TableStep
          file={state.file}
          selectedSheets={state.selectedSheets}
          tables={tables}
          onToggleSheet={(sheet) => dispatch({ type: "toggle_sheet", sheet })}
          onTableChange={(table) =>
            dispatch({ type: "set_primary_table", table })
          }
          onBack={() => dispatch({ type: "reset" })}
          onNext={() => dispatch({ type: "start_columns" })}
        />
      )}

      {state.step === "columns" && state.primaryTable && state.config && (
        <ColumnsStep
          target={state.target}
          headers={state.primaryTable.headers}
          config={state.config}
          tables={sources}
          links={links}
          onFieldChange={(field, column) =>
            dispatch({ type: "set_field", field, column })
          }
          onTypeModeChange={(mode) => dispatch({ type: "set_type_mode", mode })}
          onEntryTypeModeChange={(mode) =>
            dispatch({ type: "set_entry_type_mode", mode })
          }
          onDateFormatChange={(format) =>
            dispatch({ type: "set_date_format", format })
          }
          onTypeValueChange={(key, target) =>
            dispatch({ type: "set_type_value", key, target })
          }
          onEntryTypeValueChange={(key, target) =>
            dispatch({ type: "set_entry_type_value", key, target })
          }
          onFrequencyValueChange={(key, target) =>
            dispatch({ type: "set_frequency_value", key, target })
          }
          onFixedLinkChange={(id) => dispatch({ type: "set_fixed_link", id })}
          onBack={() => dispatch({ type: "go_to", step: "table" })}
          onNext={() => {
            if (
              state.target === "transactions" ||
              state.target === "recurring_expenses"
            ) {
              dispatch({ type: "start_categories", categories, accounts })
            } else if (
              state.config?.mapping[
                state.target === "debt_entries" ? "debt" : "goal"
              ] !== undefined
            ) {
              dispatch({ type: "start_links", options: links })
            } else {
              // Sin columna de deuda o meta, el paso 4 se salta
              showPreview()
            }
          }}
        />
      )}

      {state.step === "categories" &&
        (state.target === "debt_entries" ||
        state.target === "goal_contributions" ? (
          <LinkStep
            kind={state.target === "debt_entries" ? "debt" : "goal"}
            values={linkOptions}
            targets={state.linkTargets}
            options={links}
            onTargetChange={(key, target) =>
              dispatch({ type: "set_link_target", key, target })
            }
            loading={pending}
            error={error}
            onBack={() => goTo("columns")}
            onNext={showPreview}
          />
        ) : (
          <CategoriesStep
            expenseOnly={state.target === "recurring_expenses"}
            pairs={pairs}
            targets={state.categoryTargets}
            categories={categories}
            onTargetChange={(key, target) =>
              dispatch({ type: "set_category_target", key, target })
            }
            accountValues={accountOptions}
            accountTargets={state.accountTargets}
            accounts={accounts}
            onAccountTargetChange={(key, target) =>
              dispatch({ type: "set_account_target", key, target })
            }
            loading={pending}
            error={error}
            onBack={() => goTo("columns")}
            onNext={showPreview}
          />
        ))}

      {state.step === "preview" && preview && renderPreview(preview)}

      {state.step === "summary" && state.summary && (
        <SummaryStep
          target={state.target}
          stats={state.summary}
          onRestart={() => {
            setError(null)
            setCreateTransactions(false)
            dispatch({ type: "reset" })
          }}
        />
      )}
    </div>
  )
}

function StepIndicator({
  current,
  target
}: {
  current: StepId
  target: ImportTarget
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex

        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              active ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary text-primary"
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            {stepLabel(step.id, target)}
          </li>
        )
      })}
    </ol>
  )
}
