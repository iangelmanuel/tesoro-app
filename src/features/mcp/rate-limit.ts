import type { AppSupabase } from "@/libs/supabase/types"

/**
 * Cuenta la llamada en public.mcp_hit_rate_limit (120 por minuto por usuario,
 * en Postgres). Devuelve null si se permite o los segundos para reintentar.
 * Si la RPC falla, se deja pasar: el rate limit protege, no autoriza.
 */
export async function hitRateLimit(
  supabase: AppSupabase
): Promise<number | null> {
  const { data, error } = await supabase.rpc("mcp_hit_rate_limit")
  const row = data?.[0]

  if (error || !row) {
    return null
  }
  return row.allowed ? null : Math.max(1, row.retry_after)
}
