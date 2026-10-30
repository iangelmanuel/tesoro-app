import type { Route } from "next"
import Link from "next/link"
import { CircleCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TRANSACTIONS_PATH } from "@/features/transactions/filters"
import type { ImportStats } from "../types"

interface SummaryStepProps {
  stats: ImportStats
  onRestart: () => void
}

// Paso 6: importadas, omitidas, duplicadas omitidas y con error
export function SummaryStep({ stats, onRestart }: SummaryStepProps) {
  const items = [
    { label: "Importadas", value: stats.imported },
    { label: "Omitidas", value: stats.skipped },
    { label: "Duplicadas omitidas", value: stats.duplicates },
    { label: "Con error", value: stats.errors }
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CircleCheck className="size-6 text-primary" />
        <div className="flex flex-col">
          <p className="font-medium">Importación completada</p>
          <p className="text-sm text-muted-foreground">
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
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {item.value.toLocaleString("es-CO")}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={TRANSACTIONS_PATH as Route}>Ver movimientos</Link>
        </Button>
        <Button
          variant="outline"
          onClick={onRestart}
        >
          Importar otro archivo
        </Button>
      </div>
    </div>
  )
}
