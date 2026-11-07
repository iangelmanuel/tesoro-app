import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Cliente de Supabase tipado. Lo reciben los servicios (SPEC 34) para que la
 * misma lógica corra con la sesión de cookies (Server Actions) o con el
 * Bearer de un agente (MCP).
 */
export type AppSupabase = SupabaseClient<Database>
