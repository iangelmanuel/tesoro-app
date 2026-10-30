import { cookies } from "next/headers"
import { connection } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export async function createClient() {
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
