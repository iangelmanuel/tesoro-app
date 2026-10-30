"use client"

import { useMemo, useReducer, useState, useTransition } from "react"
import { Check } from "lucide-react"
import { cn } from "@/libs/utils"
import { confirmImport, getDuplicateCandidates } from "../actions"
import { dateRange, markDuplicates } from "../duplicates"
import {
  buildPreviewRows,
  categoryPairs,
  computeStats,
  existingCategoryKey,
  extractRows,
  newCategories,
  newCategoryKey,
  toImportRows
} from "../normalize"
import type { CategoryOption } from "../types"
import { CategoriesStep } from "./categories-step"
import { ColumnsStep } from "./columns-step"
import { FileStep } from "./file-step"
import { PreviewStep } from "./preview-step"
import { SummaryStep } from "./summary-step"
import { TableStep } from "./table-step"
import {
  INITIAL_STATE,
  STEPS,
  type StepId,
  selectedTables,
  toSourceTables,
  wizardReducer
} from "./wizard-state"

// Asistente de 6 pasos: archivo → tabla → columnas → categorías → vista
// previa → resumen. El estado vive en el cliente y se pierde al recargar.
interface ImportWizardProps {
  /** Categorías activas (sistema y propias) para el paso de categorías */
  categories: CategoryOption[]
  currency: string
}

export function ImportWizard({ categories, currency }: ImportWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE)
  // Solo se recalculan al cambiar el archivo, las hojas o la tabla, no al
  // marcar filas en la vista previa
  const { file, selectedSheets, primaryTable } = state
  const tables = useMemo(
    () => selectedTables({ file, selectedSheets, primaryTable }),
    [file, selectedSheets, primaryTable]
  )
  const sources = useMemo(() => toSourceTables(tables), [tables])
  const extracted = useMemo(
    () => (state.config ? extractRows(sources, state.config) : null),
    [sources, state.config]
  )
  const pairs = useMemo(
    () => (extracted ? categoryPairs(extracted.rows) : []),
    [extracted]
  )
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

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Aplica el mapeo de categorías y marca duplicados contra la BD
  function showPreview() {
    if (!extracted) return
    setError(null)

    startTransition(async () => {
      const rows = buildPreviewRows(extracted.rows, state.categoryTargets)
      const range = dateRange(rows)
      const result = range
        ? await getDuplicateCandidates({
            target: "transactions",
            from: range.from,
            to: range.to
          })
        : { target: "transactions" as const, candidates: [] }

      if (result.error !== undefined) {
        setError(result.error)
        return
      }

      dispatch({
        type: "preview_ready",
        rows: markDuplicates(
          rows,
          result.target === "transactions" ? result.candidates : []
        ),
        empty: extracted.empty
      })
    })
  }

  function confirm() {
    if (!state.file || !state.preview) return
    const { rows, empty } = state.preview
    const stats = computeStats(rows, empty)
    setError(null)

    startTransition(async () => {
      const result = await confirmImport({
        filename: state.file?.name ?? "",
        sheets: state.file?.isCsv
          ? []
          : sources.map((source) => source.table.sheet),
        stats,
        newCategories: newCategories(rows, state.categoryTargets, pairs),
        rows: toImportRows(rows)
      })

      if (result.error !== undefined) {
        setError(result.error)
        return
      }

      dispatch({ type: "imported", stats })
    })
  }

  function goTo(step: StepId) {
    setError(null)
    dispatch({ type: "go_to", step })
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border p-4 sm:p-6">
      <StepIndicator current={state.step} />

      {state.step === "file" && (
        <FileStep
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
          headers={state.primaryTable.headers}
          config={state.config}
          tables={sources}
          onFieldChange={(field, column) =>
            dispatch({ type: "set_field", field, column })
          }
          onTypeModeChange={(mode) => dispatch({ type: "set_type_mode", mode })}
          onDateFormatChange={(format) =>
            dispatch({ type: "set_date_format", format })
          }
          onTypeValueChange={(key, target) =>
            dispatch({ type: "set_type_value", key, target })
          }
          onBack={() => dispatch({ type: "go_to", step: "table" })}
          onNext={() => dispatch({ type: "start_categories", categories })}
        />
      )}

      {state.step === "categories" && (
        <CategoriesStep
          pairs={pairs}
          targets={state.categoryTargets}
          categories={categories}
          onTargetChange={(key, target) =>
            dispatch({ type: "set_category_target", key, target })
          }
          loading={pending}
          error={error}
          onBack={() => goTo("columns")}
          onNext={showPreview}
        />
      )}

      {state.step === "preview" && state.preview && (
        <PreviewStep
          rows={state.preview.rows}
          empty={state.preview.empty}
          currency={currency}
          categoryNames={categoryNames}
          importing={pending}
          error={error}
          onToggle={(index) => dispatch({ type: "toggle_row", index })}
          onBack={() => goTo("categories")}
          onConfirm={confirm}
        />
      )}

      {state.step === "summary" && state.summary && (
        <SummaryStep
          stats={state.summary}
          onRestart={() => {
            setError(null)
            dispatch({ type: "reset" })
          }}
        />
      )}
    </div>
  )
}

function StepIndicator({ current }: { current: StepId }) {
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
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
