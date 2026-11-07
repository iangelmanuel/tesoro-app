import { cookies } from "next/headers"
import { connection } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { AsyncLocalStorage } from "node:async_hooks"
import type { Database } from "@/types/database"
import type { AppSupabase } from "./types"

type ServerClient = ReturnType<typeof createServerClient<Database>>

// Cliente fijado para una llamada del MCP (SPEC 34): dentro de
// runWithSupabaseClient, createClient() devuelve el cliente con el Bearer del
// agente en vez de leer cookies. Así las consultas de la UI (reportes,
// score, presupuestos…) corren igual para el agente, siempre con RLS.
const scopedClient = new AsyncLocalStorage<AppSupabase>()

/**
 * Ejecuta `fn` con `client` como resultado de createClient(). Solo lo usa
 * /api/mcp. Dentro no sirven las funciones que leen la sesión con
 * auth.getUser() (p. ej. getPersonalWorkspace): el cliente no tiene sesión
 * guardada, solo el header Authorization.
 */
export function runWithSupabaseClient<T>(
  client: AppSupabase,
  fn: () => Promise<T>
): Promise<T> {
  return scopedClient.run(client, fn)
}

export async function createClient(): Promise<ServerClient> {
  const scoped = scopedClient.getStore()
  if (scoped) {
    return scoped as unknown as ServerClient
  }

  // auth-js compara la expiración del token con Date.now(): la sesión debe
  // leerse en cada request, nunca en un prerender ni un prefetch del shell
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // En Server Components no se pueden escribir cookies; el proxy
          // refresca la sesión en cada request, así que se puede ignorar.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        }
      }
    }
  )
}
