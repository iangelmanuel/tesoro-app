"use server"

import type { Route } from "next"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/libs/supabase/server"
import { MCP_ACCESS_VALUES, MCP_FALLBACK_CLIENT_NAME } from "./constants"
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
