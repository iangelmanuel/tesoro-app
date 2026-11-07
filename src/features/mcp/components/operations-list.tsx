"use client"

import { useState, useTransition } from "react"
import { Button, Chip, toast } from "@heroui/react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { TONE_BADGE_CLASSES, type Tone } from "@/components/dashboard/tone"
import { undoAgentOperation } from "../actions"
import type { AgentOperation } from "../queries"
import { formatTimestamp } from "./connections-list"

const STATUS: Record<AgentOperation["status"], { label: string; tone: Tone }> =
  {
    applied: { label: "Aplicada", tone: "success" },
    undone: { label: "Revertida", tone: "neutral" },
    failed: { label: "Fallida", tone: "danger" }
  }

function OperationRow({ operation }: { operation: AgentOperation }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const status = STATUS[operation.status]

  function undo() {
    startTransition(async () => {
      const result = await undoAgentOperation(operation.id)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success("Operación revertida")
      }
    })
  }

  return (
    <li
      className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{operation.summary}</p>
          <Chip
            size="sm"
            className={TONE_BADGE_CLASSES[status.tone]}
            color="accent"
            variant="primary"
          >
            {status.label}
          </Chip>
        </div>
        <p className="text-sm text-muted">
          {formatTimestamp(operation.createdAt)} · {operation.agent}
          {operation.workspace ? ` · ${operation.workspace}` : ""}
        </p>
      </div>

      {operation.canUndo && (
        <Button
          variant="secondary"
          className="min-h-11 self-start md:min-h-10 md:self-center"
          isDisabled={pending}
          onPress={() => setConfirming(true)}
        >
          {pending ? "Revirtiendo..." : "Revertir"}
        </Button>
      )}

      <DeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Revertir esta operación?"
        confirmLabel="Revertir"
        onConfirm={undo}
      >
        <p>
          {operation.summary}. Se borra lo que creó, vuelve lo que borró y lo
          editado regresa a como estaba. Si algo cambió después, no se revierte
          nada. No se puede rehacer.
        </p>
      </DeleteDialog>
    </li>
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
