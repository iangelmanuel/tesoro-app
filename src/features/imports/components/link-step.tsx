"use client"

import { LoaderCircle } from "lucide-react"
import { CARD_LIST } from "@/components/dashboard/surface"
import { Button } from "@/components/ui/button"
import { cn } from "@/libs/cn"
import type { LinkTarget } from "../types"
import { RowTargetSelect } from "./row-target-select"

const SKIP = "skip"

interface LinkStepProps {
  kind: "debt" | "goal"
  /** Valores de la columna de deuda o meta con su número de filas */
  values: { key: string; label: string; count: number }[]
  targets: Record<string, LinkTarget>
  /** Deudas o metas activas */
  options: { id: string; name: string }[]
  onTargetChange: (key: string, target: LinkTarget) => void
  /** Revisando duplicados antes de la vista previa */
  loading: boolean
  error: string | null
  onBack: () => void
  onNext: () => void
}

// Paso 4 de deudas y metas: cada valor de la columna Deuda o Meta con su
// número de filas y su destino: una deuda o meta activa o "No importar"
export function LinkStep({
  kind,
  values,
  targets,
  options,
  onTargetChange,
  loading,
  error,
  onBack,
  onNext
}: LinkStepProps) {
  const rowCount = values
    .filter((value) => targets[value.key]?.kind === "existing")
    .reduce((total, value) => total + value.count, 0)
  const noun = kind === "debt" ? "deuda" : "meta"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">
          {kind === "debt" ? "Deudas" : "Metas"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Elige a qué {noun} va cada valor de tu archivo. Solo aparecen las{" "}
          {kind === "debt" ? "deudas" : "metas"} activas. Marca «No importar»
          para omitir sus filas.
        </p>
      </div>

      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay filas válidas para importar. Vuelve al paso anterior y revisa
          el mapeo de columnas.
        </p>
      ) : (
        <ul className={cn(CARD_LIST, "rounded-2xl bg-subtle px-4")}>
          {values.map((value) => {
            const target = targets[value.key]

            return (
              <li
                key={value.key}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="text-sm">
                  {value.label}{" "}
                  <span className="text-muted-foreground">
                    · {value.count === 1 ? "1 fila" : `${value.count} filas`}
                  </span>
                </span>
                <RowTargetSelect
                  aria-label={`${kind === "debt" ? "Deuda" : "Meta"} para ${value.label}`}
                  value={target?.kind === "existing" ? target.id : SKIP}
                  onChange={(next) =>
                    onTargetChange(
                      value.key,
                      next === SKIP
                        ? { kind: "skip" }
                        : { kind: "existing", id: next }
                    )
                  }
                  groups={[
                    {
                      label: kind === "debt" ? "Tus deudas" : "Tus metas",
                      options: options.map((option) => ({
                        value: option.id,
                        label: option.name
                      }))
                    },
                    { options: [{ value: SKIP, label: "No importar" }] }
                  ]}
                />
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onBack}
        >
          Atrás
        </Button>
        <Button
          type="button"
          disabled={rowCount === 0 || loading}
          onClick={onNext}
        >
          {loading && (
            <LoaderCircle
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          )}
          Ver vista previa
        </Button>
      </div>
    </div>
  )
}
