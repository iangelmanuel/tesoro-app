import "server-only"
import { cache } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/libs/supabase/server"

/**
 * Usuario de la sesión del request, validado contra el servidor de auth
 * (`getUser`), o null sin sesión. Es la única lectura de sesión del camino de
 * lectura del dashboard (SPEC 56a): `cache()` deduplica por función, así que
 * `getDashboardUser`, `getPersonalWorkspace`, `getAccount` y
 * `getCompletedTutorials` la comparten y el request hace una sola ida a
 * Supabase Auth.
 *
 * Lee las cookies: va dentro de un Suspense por cacheComponents. Las
 * escrituras que validan la sesión antes de escribir siguen con su propio
 * `getUser()`. El MCP valida su Bearer en `features/mcp/auth.ts`.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return user
})
