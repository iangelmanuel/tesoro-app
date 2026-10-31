import type { Route } from "next"
import Link from "next/link"
import { Button, buttonVariants } from "@heroui/react"
import { CircleCheck } from "lucide-react"
import { IMPORT_TARGETS } from "../targets"
import type { ImportStats, ImportTarget } from "../types"

interface SummaryStepProps {
  target: ImportTarget
  stats: ImportStats
  onRestart: () => void
}

// Paso 6: importadas, omitidas, duplicadas omitidas y con error, con enlace
// a la página del destino
export function SummaryStep({ target, stats, onRestart }: SummaryStepProps) {
  const { label, href } = IMPORT_TARGETS[target]
  const items = [
    { label: "Importadas", value: stats.imported },
    { label: "Omitidas", value: stats.skipped },
    { label: "Duplicadas omitidas", value: stats.duplicates },
    { label: "Con error", value: stats.errors }
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CircleCheck className="size-6 text-accent" />
        <div className="flex flex-col">
          <p className="font-medium">Importación completada · {label}</p>
          <p className="text-sm text-muted">
            Puedes deshacerla desde el historial cuando quieras.
          </p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-lg border p-4"
          >
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {item.value.toLocaleString("es-CO")}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link
          href={href as Route}
          className={buttonVariants()}
        >
          Ver {label.toLowerCase()}
        </Link>
        <Button
          variant="outline"
          onPress={onRestart}
        >
          Importar otro archivo
        </Button>
      </div>
    </div>
  )
}
