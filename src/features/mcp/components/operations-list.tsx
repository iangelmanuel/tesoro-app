"use client"

import { useState, useTransition } from "react"
import { Undo2 } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/row-actions"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES, type Tone } from "@/components/dashboard/tone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/sonner"
import { undoAgentOperation } from "../actions"
import type { AgentOperation } from "../queries"
import { formatTimestamp } from "./connections-list"

const STATUS: Record<AgentOperation["status"], { label: string; tone: Tone }> =
  {
    applied: { label: "Aplicado", tone: "success" },
    undone: { label: "Deshecho", tone: "neutral" },
    failed: { label: "Fallido", tone: "danger" }
  }

function OperationRow({ operation }: { operation: AgentOperation }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const status = STATUS[operation.status]

  function undo() {
    startTransition(async () => {
      const result = await undoAgentOperation(operation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Cambio deshecho")
      }
    })
  }

  // Deshabilitada si ya se revirtió, falló o venció la ventana (canUndo)
  const actions: RowAction[] = [
    {
      id: "undo",
      label: "Revertir operación",
      icon: <Undo2 />,
      disabled: !operation.canUndo || pending,
      onAction: () => setConfirming(true)
    }
  ]

  return (
    <RowContextMenu
      label={operation.summary}
      actions={actions}
    >
      <li
        className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{operation.summary}</p>
            <Badge className={TONE_BADGE_CLASSES[status.tone]}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatTimestamp(operation.createdAt)} · {operation.agent}
            {operation.workspace ? ` · ${operation.workspace}` : ""}
          </p>
        </div>

        {operation.canUndo && (
          <Button
            variant="secondary"
            className="self-start md:self-center"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {pending ? "Deshaciendo..." : "Deshacer"}
          </Button>
        )}

        {/* El diálogo se pinta en un portal; RowMenuBoundary evita que un clic
        derecho dentro de él abra el menú de la fila */}
        <RowMenuBoundary>
          <DeleteDialog
            open={confirming}
            onOpenChange={setConfirming}
            title="¿Deshacer este cambio?"
            confirmLabel="Deshacer"
            onConfirm={undo}
          >
            <p>
              {operation.summary}. Se borra lo que creó, vuelve lo que borró y
              lo editado regresa a como estaba. Si algo cambió después, o si lo
              que creó (una cuenta, una deuda, un fijo…) ya tiene movimientos,
              pagos o aportes, no se deshace nada. No se puede rehacer.
            </p>
          </DeleteDialog>
        </RowMenuBoundary>
      </li>
    </RowContextMenu>
  )
}

export function OperationsList({
  operations
}: {
  operations: AgentOperation[]
}) {
  return (
    <ul className={CARD_LIST}>
      {operations.map((operation) => (
        <OperationRow
          key={operation.id}
          operation={operation}
        />
      ))}
    </ul>
  )
}

/** Historial mientras carga: misma lista y filas */
export function OperationsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className={CARD_LIST}>
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-20 rounded-4xl" />
            </div>
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-11 w-28 self-start rounded-4xl md:self-center" />
        </li>
      ))}
    </ul>
  )
}
