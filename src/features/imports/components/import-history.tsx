"use client"

import { useTransition } from "react"
import { FileClock, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { CardEmpty } from "@/components/dashboard/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TIME_ZONE } from "@/libs/dates"
import { undoImport } from "../actions"
import type { ImportRecord } from "../queries"
import { IMPORT_TARGETS, countLabel } from "../targets"
import type { ImportTarget } from "../types"

const DATE_TIME = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE
})

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count.toLocaleString("es-CO")} ${many}`
}

/** Qué más pasa al deshacer, según el destino */
function undoNotes(target: ImportTarget, linkedTransactions: number) {
  switch (target) {
    case "transactions":
      return "Las categorías creadas se conservan. Si alguno quedó enlazado a un pago de deuda, el pago se queda sin movimiento."
    case "recurring_expenses":
      return "Las categorías creadas se conservan. Los movimientos que pagaban sus ocurrencias se quedan, sin enlace al gasto fijo."
    case "debt_entries":
      return linkedTransactions > 0
        ? `También se borrarán ${plural(linkedTransactions, "movimiento creado", "movimientos creados")} con los pagos.`
        : "El saldo de cada deuda vuelve a como estaba sin estos pagos y ajustes."
    case "goal_contributions":
      return "Lo ahorrado en cada meta vuelve a como estaba sin estos aportes y retiros."
  }
}

// Historial de importaciones bajo el asistente, con "Deshacer" siempre
// disponible mientras la importación no se haya deshecho
export function ImportHistory({ imports }: { imports: ImportRecord[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Historial</h2>
      {imports.length === 0 ? (
        <CardEmpty
          icon={FileClock}
          message="Aún no has importado archivos"
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {imports.map((item) => (
            <ImportHistoryItem
              key={item.id}
              item={item}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function ImportHistoryItem({ item }: { item: ImportRecord }) {
  const undone = item.status === "undone"
  const { stats } = item

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{item.filename}</p>
          <Badge variant="outline">{IMPORT_TARGETS[item.target].label}</Badge>
          {undone ? (
            <Badge variant="outline">Deshecho</Badge>
          ) : (
            <Badge variant="secondary">Completado</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {DATE_TIME.format(new Date(item.created_at))}
          {item.sheets.length > 0 && ` · ${item.sheets.join(", ")}`}
        </p>
        <p className="text-sm text-muted-foreground">
          {plural(stats.imported, "importada", "importadas")} ·{" "}
          {plural(stats.skipped, "omitida", "omitidas")} ·{" "}
          {plural(stats.duplicates, "duplicada omitida", "duplicadas omitidas")}{" "}
          · {plural(stats.errors, "con error", "con error")}
        </p>
      </div>
      {!undone && <UndoImportButton item={item} />}
    </li>
  )
}

function UndoImportButton({ item }: { item: ImportRecord }) {
  const [pending, startTransition] = useTransition()
  const count = item.rows_count
  const rows = countLabel(item.target, count)

  function handleUndo() {
    startTransition(async () => {
      const result = await undoImport(item.id)
      if (result.error !== undefined) {
        toast.error(result.error)
      } else {
        toast.success(
          `Importación deshecha: ${countLabel(item.target, result.deleted)} ${result.deleted === 1 ? "borrado" : "borrados"}`
        )
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
        >
          <Undo2 data-icon="inline-start" />
          Deshacer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Deshacer esta importación?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borrarán {rows} de &ldquo;{item.filename}&rdquo;, también los que
            hayas editado después.{" "}
            {undoNotes(item.target, item.linked_transactions)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleUndo}
          >
            Borrar {rows}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
