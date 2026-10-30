"use client"

import { useMemo, useReducer } from "react"
import { Check } from "lucide-react"
import { cn } from "@/libs/utils"
import { FileStep } from "./file-step"
import { TableStep } from "./table-step"
import {
  INITIAL_STATE,
  STEPS,
  type StepId,
  selectedTables,
  wizardReducer
} from "./wizard-state"

// Asistente de 6 pasos: archivo → tabla → columnas → categorías → vista
// previa → resumen. El estado vive en el cliente y se pierde al recargar.
export function ImportWizard() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE)
  const tables = useMemo(() => selectedTables(state), [state])

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
          onNext={() => dispatch({ type: "go_to", step: "columns" })}
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
