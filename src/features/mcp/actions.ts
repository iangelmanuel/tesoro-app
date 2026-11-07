"use server"

import type { Route } from "next"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import {
  MCP_ACCESS_VALUES,
  MCP_AGENTS_PATH,
  MCP_FALLBACK_CLIENT_NAME
} from "./constants"
import { undoOperation } from "./operations"
import type { ConsentFormState } from "./types"

// Consentimiento OAuth de un agente (SPEC 34). Supabase guarda el grant; la
// fila de mcp_connections guarda el acceso elegido. Si el upsert falla, el
// agente queda en solo lectura (una conexión sin fila cae en 'read').

const INVALID_REQUEST =
  "Esta solicitud ya no es válida. Vuelve a conectar desde tu agente."
const DEFAULT_ERROR = "No se pudo completar la autorización. Intenta de nuevo"

const approveSchema = z.object({
  authorization_id: z.string().trim().min(1).max(200),
  access: z.enum(MCP_ACCESS_VALUES)
})

const denySchema = approveSchema.pick({ authorization_id: true })

export async function approveMcpAuthorization(
  _prevState: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> {
  const parsed = approveSchema.safeParse({
    authorization_id: formData.get("authorization_id"),
    access: formData.get("access")
  })
  if (!parsed.success) {
    return { error: INVALID_REQUEST }
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: INVALID_REQUEST }
  }

  // El cliente se lee del servidor de auth, nunca del formulario
  const { data: details, error: detailsError } =
    await supabase.auth.oauth.getAuthorizationDetails(
      parsed.data.authorization_id
    )
  if (detailsError || !details) {
    return { error: INVALID_REQUEST }
  }
  // Ya autorizado antes: Supabase devuelve directo la URL de vuelta
  if (!("authorization_id" in details)) {
    redirect(details.redirect_url as Route)
  }

  const { data, error } = await supabase.auth.oauth.approveAuthorization(
    parsed.data.authorization_id,
    { skipBrowserRedirect: true }
  )
  if (error || !data) {
    return { error: DEFAULT_ERROR }
  }

  // Un fallo aquí no bloquea la autorización: la conexión queda en lectura
  await supabase.from("mcp_connections").upsert(
    {
      user_id: user.id,
      client_id: details.client.id,
      client_name:
        details.client.name.trim().slice(0, 120) || MCP_FALLBACK_CLIENT_NAME,
      access: parsed.data.access
    },
    { onConflict: "user_id,client_id" }
  )

  redirect(data.redirect_url as Route)
}

export async function denyMcpAuthorization(
  _prevState: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> {
  const parsed = denySchema.safeParse({
    authorization_id: formData.get("authorization_id")
  })
  if (!parsed.success) {
    return { error: INVALID_REQUEST }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.oauth.denyAuthorization(
    parsed.data.authorization_id,
    { skipBrowserRedirect: true }
  )
  if (error || !data) {
    return { error: INVALID_REQUEST }
  }

  redirect(data.redirect_url as Route)
}

// Cuenta → Agentes IA: cambiar acceso, revocar y revertir (SPEC 34)

export interface AgentActionResult {
  error?: string
}

const AGENT_DEFAULT_ERROR = "No se pudo guardar el cambio. Intenta de nuevo"

const accessSchema = z.object({
  clientId: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120),
  access: z.enum(MCP_ACCESS_VALUES)
})

async function currentUserId() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  return user ? { supabase, userId: user.id } : null
}

/** Cambia el acceso de un agente. Aplica en su siguiente llamada */
export async function updateAgentAccess(
  clientId: string,
  name: string,
  access: string
): Promise<AgentActionResult> {
  const parsed = accessSchema.safeParse({ clientId, name, access })
  const session = await currentUserId()
  if (!parsed.success || !session) {
    return { error: AGENT_DEFAULT_ERROR }
  }

  // Un grant sin fila (falló el upsert del consentimiento) la crea aquí
  const { error } = await session.supabase.from("mcp_connections").upsert(
    {
      user_id: session.userId,
      client_id: parsed.data.clientId,
      client_name: parsed.data.name || MCP_FALLBACK_CLIENT_NAME,
      access: parsed.data.access
    },
    { onConflict: "user_id,client_id" }
  )
  if (error) {
    return { error: AGENT_DEFAULT_ERROR }
  }

  revalidatePath(MCP_AGENTS_PATH)
  return {}
}

/**
 * Revoca un agente: Supabase borra su grant y sus sesiones (la siguiente
 * llamada responde 401) y se borra su fila de mcp_connections. Su historial
 * se conserva.
 */
export async function revokeAgent(
  clientId: string
): Promise<AgentActionResult> {
  const parsed = accessSchema.shape.clientId.safeParse(clientId)
  const session = await currentUserId()
  if (!parsed.success || !session) {
    return { error: "No se pudo revocar el agente. Intenta de nuevo" }
  }

  const { error } = await session.supabase.auth.oauth.revokeGrant({
    clientId: parsed.data
  })
  if (error) {
    return { error: "No se pudo revocar el agente. Intenta de nuevo" }
  }

  await session.supabase
    .from("mcp_connections")
    .delete()
    .eq("user_id", session.userId)
    .eq("client_id", parsed.data)

  revalidatePath(MCP_AGENTS_PATH)
  return {}
}

/** Revierte una operación del historial con la misma RPC que undo_operation */
export async function undoAgentOperation(
  operationId: string
): Promise<AgentActionResult> {
  const parsed = z.uuid().safeParse(operationId)
  if (!parsed.success) {
    return { error: "No se encontró la operación" }
  }

  const result = await undoOperation(await createClient(), parsed.data)
  if (!result.ok) {
    return { error: result.error }
  }

  // Lo revertido toca movimientos y traspasos de cualquier espacio
  revalidatePath(SITE.routes.dashboard, "layout")
  return {}
}
