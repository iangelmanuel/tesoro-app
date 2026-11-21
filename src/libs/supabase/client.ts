import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

/** Cliente de Supabase para componentes cliente: clave publicable y RLS */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
