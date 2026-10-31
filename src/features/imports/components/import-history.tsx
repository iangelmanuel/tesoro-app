"use client"

import { useTransition } from "react"
import { AlertDialog, Button, Chip, toast } from "@heroui/react"
import { FileClock, Undo2 } from "lucide-react"
import { CardEmpty } from "@/components/dashboard/empty-state"
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
          <Chip
            size="sm"
            variant="tertiary"
            className="border border-border"
          >
            {IMPORT_TARGETS[item.target].label}
          </Chip>
          {undone ? (
            <Chip
              size="sm"
              variant="tertiary"
              className="border border-border"
            >
              Deshecho
            </Chip>
          ) : (
            <Chip size="sm">Completado</Chip>
          )}
        </div>
        <p className="text-sm text-muted">
          {DATE_TIME.format(new Date(item.created_at))}
          {item.sheets.length > 0 && ` · ${item.sheets.join(", ")}`}
        </p>
        <p className="text-sm text-muted">
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
        toast.danger(result.error)
      } else {
        toast.success(
          `Importación deshecha: ${countLabel(item.target, result.deleted)} ${result.deleted === 1 ? "borrado" : "borrados"}`
        )
      }
    })
  }

  return (
    <AlertDialog>
      <Button
        variant="outline"
        size="sm"
        isDisabled={pending}
      >
        <Undo2 />
        Deshacer
      </Button>
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-md">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                ¿Deshacer esta importación?
              </AlertDialog.Heading>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  Se borrarán {rows} de &ldquo;{item.filename}&rdquo;, también
                  los que hayas editado después.{" "}
                  {undoNotes(item.target, item.linked_transactions)}
                </p>
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant="tertiary"
              >
                Cancelar
              </Button>
              <Button
                slot="close"
                variant="danger"
                onPress={handleUndo}
              >
                Borrar {rows}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  )
}
