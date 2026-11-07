"use client"

import { useState, useTransition } from "react"
import type { Key } from "react"
import { Button, Label, ListBox, Select, toast } from "@heroui/react"
import { Bot } from "lucide-react"
import { DeleteDialog } from "@/components/dashboard/delete-dialog"
import { CARD_LIST, CARD_ROW } from "@/components/dashboard/surface"
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

function ConnectionRow({ connection }: { connection: AgentConnection }) {
  const [access, setAccess] = useState<McpAccess>(connection.access)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  function changeAccess(key: Key | null) {
    const next = key as McpAccess | null
    if (!next || next === access) return
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
        toast.danger(result.error)
      } else {
        toast.success(`Acceso cambiado a ${MCP_ACCESS_OPTIONS[next].label}`)
      }
    })
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeAgent(connection.clientId)
      if (result.error) {
        toast.danger(result.error)
      } else {
        toast.success(`${connection.name} ya no tiene acceso`)
      }
    })
  }

  return (
    <li
      className={`${CARD_ROW} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-default text-muted">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{connection.name}</p>
          <p className="text-sm text-muted">
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          aria-label={`Acceso de ${connection.name}`}
          selectedKey={access}
          onSelectionChange={changeAccess}
          isDisabled={pending}
          className="flex w-full flex-col gap-2 sm:w-48"
        >
          <Label className="sr-only">Acceso</Label>
          <Select.Trigger className="min-h-11 md:min-h-10">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {MCP_ACCESS_VALUES.map((value) => (
                <ListBox.Item
                  key={value}
                  id={value}
                  textValue={MCP_ACCESS_OPTIONS[value].label}
                >
                  {MCP_ACCESS_OPTIONS[value].label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Button
          variant="danger-soft"
          className="min-h-11 md:min-h-10"
          isDisabled={pending}
          onPress={() => setConfirming(true)}
        >
          Revocar
        </Button>
      </div>

      <DeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`¿Revocar a ${connection.name}?`}
        confirmLabel="Revocar"
        onConfirm={revoke}
      >
        <p>
          Dejará de tener acceso a tu cuenta desde su siguiente llamada. Para
          volver a usarlo tendrás que conectarlo de nuevo. Su historial de
          operaciones se conserva.
        </p>
      </DeleteDialog>
    </li>
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
