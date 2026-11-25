"use server"

import type { Route } from "next"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { SITE } from "@/config/site"
import { createClient } from "@/libs/supabase/server"
import {
  INVALID_REQUEST,
  approveConsent,
  denyConsent,
  revokeConnection,
  saveConnectionAccess,
  sessionUserId
} from "./connection-service"
import { MCP_ACCESS_VALUES, MCP_AGENTS_PATH } from "./constants"
import { undoOperation } from "./operations"
import type { ConsentFormState } from "./types"

// Consentimiento OAuth de un agente y Cuenta → Agentes IA (SPEC 34). La
// lógica vive en connection-service.ts.

const approveSchema = z.object({
  authorization_id: z.string().trim().min(1).max(200),
  access: z.enum(MCP_ACCESS_VALUES)
})

const denySchema = approveSchema.pick({ authorization_id: true })

/** Aprueba el consentimiento y vuelve al agente */
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

  const result = await approveConsent(
    await createClient(),
    parsed.data.authorization_id,
    parsed.data.access
  )
  if ("error" in result) {
    return { error: result.error }
  }
  redirect(result.redirectUrl as Route)
}

/** Rechaza el consentimiento y vuelve al agente */
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

  const result = await denyConsent(
    await createClient(),
    parsed.data.authorization_id
  )
  if ("error" in result) {
    return { error: result.error }
  }
  redirect(result.redirectUrl as Route)
}

/** Resultado de las acciones de Cuenta → Agentes IA */
export interface AgentActionResult {
  error?: string
}

const AGENT_DEFAULT_ERROR = "No se pudo guardar el cambio. Intenta de nuevo"
const REVOKE_ERROR = "No se pudo revocar el agente. Intenta de nuevo"

const accessSchema = z.object({
  clientId: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120),
  access: z.enum(MCP_ACCESS_VALUES)
})

/** Cambia el acceso de un agente. Aplica en su siguiente llamada */
export async function updateAgentAccess(
  clientId: string,
  name: string,
  access: string
): Promise<AgentActionResult> {
  const parsed = accessSchema.safeParse({ clientId, name, access })
  const supabase = await createClient()
  const userId = await sessionUserId(supabase)
  if (!parsed.success || !userId) {
    return { error: AGENT_DEFAULT_ERROR }
  }

  // Un grant sin fila (falló el upsert del consentimiento) la crea aquí
  const saved = await saveConnectionAccess(supabase, {
    userId,
    clientId: parsed.data.clientId,
    clientName: parsed.data.name,
    access: parsed.data.access
  })
  if (!saved) {
    return { error: AGENT_DEFAULT_ERROR }
  }

  revalidatePath(MCP_AGENTS_PATH)
  return {}
}

/** Revoca un agente y borra su conexión */
export async function revokeAgent(
  clientId: string
): Promise<AgentActionResult> {
  const parsed = accessSchema.shape.clientId.safeParse(clientId)
  const supabase = await createClient()
  const userId = await sessionUserId(supabase)
  if (!parsed.success || !userId) {
    return { error: REVOKE_ERROR }
  }

  if (!(await revokeConnection(supabase, userId, parsed.data))) {
    return { error: REVOKE_ERROR }
  }

  revalidatePath(MCP_AGENTS_PATH)
  return {}
}

/** Revierte una operación del historial con la misma RPC que undo_operation */
export async function undoAgentOperation(
  operationId: string
): Promise<AgentActionResult> {
  const parsed = z.uuid().safeParse(operationId)
  if (!parsed.success) {
    return { error: "No se encontró el cambio" }
  }

  const result = await undoOperation(await createClient(), parsed.data)
  if (!result.ok) {
    return { error: result.error }
  }

  // Lo revertido toca movimientos y traspasos de cualquier espacio
  revalidatePath(SITE.routes.dashboard, "layout")
  return {}
}
