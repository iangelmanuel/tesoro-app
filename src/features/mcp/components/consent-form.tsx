"use client"

import { useActionState, useState } from "react"
import { Button, Tabs } from "@heroui/react"
import { approveMcpAuthorization, denyMcpAuthorization } from "../actions"
import {
  MCP_ACCESS_OPTIONS,
  MCP_ACCESS_VALUES,
  type McpAccess
} from "../constants"
import type { ConsentFormState } from "../types"

interface ConsentFormProps {
  authorizationId: string
}

// Acceso (Leer y escribir | Solo lectura) y los botones Autorizar y Cancelar.
// Cancelar va en su propio formulario: no envía el acceso
export function ConsentForm({ authorizationId }: ConsentFormProps) {
  const [access, setAccess] = useState<McpAccess>("write")
  const [approveState, approveAction, approving] = useActionState<
    ConsentFormState,
    FormData
  >(approveMcpAuthorization, {})
  const [denyState, denyAction, denying] = useActionState<
    ConsentFormState,
    FormData
  >(denyMcpAuthorization, {})

  const pending = approving || denying
  const error = approveState.error ?? denyState.error

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Acceso</p>
        <Tabs
          selectedKey={access}
          onSelectionChange={(key) => setAccess(key as McpAccess)}
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Acceso del agente"
              className="w-full"
            >
              {MCP_ACCESS_VALUES.map((value) => (
                <Tabs.Tab
                  key={value}
                  id={value}
                  className="flex-1"
                >
                  {MCP_ACCESS_OPTIONS[value].label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <p
          className="text-sm text-muted"
          aria-live="polite"
        >
          {MCP_ACCESS_OPTIONS[access].description}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <form action={denyAction}>
          <input
            type="hidden"
            name="authorization_id"
            value={authorizationId}
          />
          <Button
            type="submit"
            variant="secondary"
            fullWidth
            isDisabled={pending}
          >
            {denying ? "Cancelando..." : "Cancelar"}
          </Button>
        </form>
        <form action={approveAction}>
          <input
            type="hidden"
            name="authorization_id"
            value={authorizationId}
          />
          <input
            type="hidden"
            name="access"
            value={access}
          />
          <Button
            type="submit"
            fullWidth
            isDisabled={pending}
          >
            {approving ? "Autorizando..." : "Autorizar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
