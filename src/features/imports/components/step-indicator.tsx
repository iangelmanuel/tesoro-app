import { Check } from "lucide-react"
import { cn } from "@/libs/cn"
import type { ImportTarget } from "../types"
import { stepLabel } from "./wizard-selectors"
import { STEPS, type StepId } from "./wizard-types"

/** Pasos del asistente con el actual resaltado y los hechos con ✓ */
export function StepIndicator({
  current,
  target
}: {
  current: StepId
  target: ImportTarget
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === current)

  return (
    <ol
      aria-label="Pasos de la importación"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
    >
      {STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex

        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex min-h-8 items-center gap-2",
              active ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                active && "bg-primary text-primary-foreground",
                done && "bg-success-soft text-success-soft-foreground",
                !active && !done && "bg-subtle"
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            {/* En el teléfono solo se lee el paso actual; los demás quedan
                para el lector de pantalla */}
            <span className={cn(!active && "max-sm:sr-only")}>
              {stepLabel(step.id, target)}
              {done && <span className="sr-only"> (completado)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
