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
  const count = item.transactions_count

  function handleUndo() {
    startTransition(async () => {
      const result = await undoImport(item.id)
      if (result.error !== undefined) {
        toast.error(result.error)
      } else {
        toast.success(
          `Importación deshecha: ${plural(result.deleted, "movimiento borrado", "movimientos borrados")}`
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
            Se borrarán {plural(count, "movimiento", "movimientos")} de &ldquo;
            {item.filename}&rdquo;, también los que hayas editado después. Las
            categorías creadas se conservan. Si alguno quedó enlazado a un pago
            de deuda, el pago se queda sin movimiento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleUndo}
          >
            Borrar {plural(count, "movimiento", "movimientos")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
