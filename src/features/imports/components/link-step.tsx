"use client"

import { Button, Header, ListBox, Select, Separator } from "@heroui/react"
import { LoaderCircle } from "lucide-react"
import type { LinkTarget } from "../types"

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
        <p className="text-sm text-muted">
          Elige a qué {noun} va cada valor de tu archivo. Solo aparecen las{" "}
          {kind === "debt" ? "deudas" : "metas"} activas. Marca «No importar»
          para omitir sus filas.
        </p>
      </div>

      {values.length === 0 ? (
        <p className="text-sm text-muted">
          No hay filas válidas para importar. Vuelve al paso anterior y revisa
          el mapeo de columnas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {values.map((value) => {
            const target = targets[value.key]

            return (
              <li
                key={value.key}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-sm">
                  {value.label}{" "}
                  <span className="text-muted">
                    · {value.count === 1 ? "1 fila" : `${value.count} filas`}
                  </span>
                </span>
                <Select
                  value={
                    (target?.kind === "existing" ? target.id : SKIP) || null
                  }
                  onChange={(key) =>
                    key != null &&
                    ((next) =>
                      onTargetChange(
                        value.key,
                        next === SKIP
                          ? { kind: "skip" }
                          : { kind: "existing", id: next }
                      ))(String(key))
                  }
                  fullWidth
                  className="sm:w-56"
                  aria-label={`${kind === "debt" ? "Deuda" : "Meta"} para ${value.label}`}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Section>
                        <Header>
                          {kind === "debt" ? "Tus deudas" : "Tus metas"}
                        </Header>
                        {options.map((option) => (
                          <ListBox.Item
                            key={option.id}
                            id={option.id}
                            textValue={String(option.name)}
                          >
                            {option.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox.Section>
                      <Separator />
                      <ListBox.Item
                        id={SKIP}
                        textValue="No importar"
                      >
                        No importar
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </li>
            )
          })}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          isDisabled={loading}
          onPress={onBack}
        >
          Atrás
        </Button>
        <Button
          isDisabled={rowCount === 0 || loading}
          onPress={onNext}
        >
          {loading && <LoaderCircle className="animate-spin" />}
          Ver vista previa
        </Button>
      </div>
    </div>
  )
}
