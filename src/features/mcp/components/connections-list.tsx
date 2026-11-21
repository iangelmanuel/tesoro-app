"use client"

import { useState, useTransition } from "react"
import { Bot, Unplug } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import {
  type RowAction,
  RowContextMenu,
  RowMenuBoundary
} from "@/components/dashboard/row-actions"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
import { SelectField } from "@/components/forms/select-field"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/sonner"
import { todayISO } from "@/libs/dates"
import { formatDate } from "@/libs/format"
import { revokeAgent, updateAgentAccess } from "../actions"
import {
  MCP_ACCESS_OPTIONS,
  MCP_ACCESS_VALUES,
  type McpAccess
} from "../constants"
import type { AgentConnection } from "../queries"

/** Fecha de un timestamp en America/Bogota, como la UI */
export function formatTimestamp(value: string) {
  return formatDate(todayISO(new Date(value)))
}

const ACCESS_OPTIONS = MCP_ACCESS_VALUES.map((value) => ({
  value,
  label: MCP_ACCESS_OPTIONS[value].label
}))

function ConnectionRow({ connection }: { connection: AgentConnection }) {
  const [access, setAccess] = useState<McpAccess>(connection.access)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function changeAccess(next: McpAccess) {
    if (next === access) return
    const previous = access
    setAccess(next)
    startTransition(async () => {
      const result = await updateAgentAccess(
        connection.clientId,
        connection.name,
        next
      )
      if (result.error) {
        setAccess(previous)
        toast.error(result.error)
      } else {
        toast.success(`Acceso cambiado a ${MCP_ACCESS_OPTIONS[next].label}`)
      }
    })
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeAgent(connection.clientId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${connection.name} ya no tiene acceso`)
      }
    })
  }

  const actions: RowAction[] = [
    {
      id: "revoke",
      label: "Revocar conexión",
      icon: <Unplug />,
      destructive: true,
      disabled: pending,
      onAction: () => setConfirming(true)
    }
  ]

  return (
    <RowContextMenu
      label={connection.name}
      actions={actions}
    >
      <li
        className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-muted-foreground">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{connection.name}</p>
            <p className="text-sm text-muted-foreground">
              {connection.authorizedAt
                ? `Autorizado el ${formatTimestamp(connection.authorizedAt)}`
                : "Autorizado"}
              {" · "}
              {connection.lastUsedAt
                ? `Último uso el ${formatTimestamp(connection.lastUsedAt)}`
                : "Sin uso todavía"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <SelectField
            label="Acceso"
            help="mcp.access"
            value={access}
            onChange={changeAccess}
            options={ACCESS_OPTIONS}
            disabled={pending}
            className="w-full sm:w-48"
          />
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Revocar
          </Button>
        </div>

        {/* El diálogo se pinta en un portal; RowMenuBoundary evita que un clic
        derecho dentro de él abra el menú de la fila */}
        <RowMenuBoundary>
          <DeleteDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={`¿Revocar a ${connection.name}?`}
            confirmLabel="Revocar"
            onConfirm={revoke}
          >
            <p>
              Dejará de tener acceso a tu cuenta desde su siguiente llamada.
              Para volver a usarlo tendrás que conectarlo de nuevo. Su historial
              de cambios se conserva.
            </p>
          </DeleteDialog>
        </RowMenuBoundary>
      </li>
    </RowContextMenu>
  )
}

export function ConnectionsList({
  connections
}: {
  connections: AgentConnection[]
}) {
  return (
    <ul className={CARD_LIST}>
      {connections.map((connection) => (
        <ConnectionRow
          key={connection.clientId}
          connection={connection}
        />
      ))}
    </ul>
  )
}

/** Agentes conectados mientras carga: misma lista y filas */
export function ConnectionsListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <ul className={CARD_LIST}>
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-56" />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-48">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <Skeleton className="h-11 w-24 rounded-4xl" />
          </div>
        </li>
      ))}
    </ul>
  )
}
