"use client"

import { CARD } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/libs/cn"
import type { DebtLinkOption, GoalLinkOption } from "../queries"
import type { AccountOption, CategoryOption, ImportTarget } from "../types"
import { CategoriesStep } from "./categories-step"
import { ColumnsStep } from "./columns-step"
import { FileStep } from "./file-step"
import { LinkStep } from "./link-step"
import { StepIndicator } from "./step-indicator"
import { SummaryStep } from "./summary-step"
import { TableStep } from "./table-step"
import { useImportWizard } from "./use-import-wizard"
import { WizardPreview } from "./wizard-preview"
import { linkFieldOf, previewBackStep } from "./wizard-selectors"
import { STEPS } from "./wizard-types"

// Asistente de 6 pasos: archivo → tabla → columnas → categorías (o deudas o
// metas) → vista previa → resumen. El estado vive en el cliente y se pierde
// al recargar (use-import-wizard.ts).
interface ImportWizardProps {
  /** Espacio Personal: crear categorías y cuentas desde el paso 4 */
  workspaceId: string
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

export function ImportWizard({
  workspaceId,
  initialTarget,
  categories,
  accounts,
  debts,
  goals,
  currency
}: ImportWizardProps) {
  const {
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
  } = useImportWizard({ initialTarget, categories, accounts, debts, goals })

  return (
    <div className={cn(CARD, "gap-6 sm:p-6")}>
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
            const linkField = linkFieldOf(state.target)
            if (!linkField) {
              dispatch({ type: "start_categories", categories, accounts })
            } else if (state.config?.mapping[linkField] !== undefined) {
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
            workspaceId={workspaceId}
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

      {state.step === "preview" && state.preview && (
        <WizardPreview
          preview={state.preview}
          currency={currency}
          categoryNames={categoryNames}
          accountNames={accountNames}
          linkNames={linkNames}
          balances={balances}
          negative={negative}
          hasLinkedPayments={hasLinkedPayments}
          createTransactions={createTransactions}
          onCreateTransactionsChange={setCreateTransactions}
          importing={pending}
          error={error}
          onToggle={(index) => dispatch({ type: "toggle_row", index })}
          onBack={() => goTo(previewBackStep(state.target, state.config))}
          onConfirm={confirm}
        />
      )}

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

/** Hueco del asistente: pasos, destinos y la zona del archivo (paso 1) */
export function ImportWizardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className={cn(CARD, "gap-6 sm:p-6")}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {Array.from({ length: STEPS.length }, (_, index) => (
          <div
            key={index}
            className="flex min-h-8 items-center gap-2"
          >
            <Skeleton className="size-7 rounded-full" />
            <Skeleton
              className={cn("h-4 w-20", index > 0 && "max-sm:hidden")}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-44" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="h-20 rounded-2xl"
            />
          ))}
        </div>
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  )
}
