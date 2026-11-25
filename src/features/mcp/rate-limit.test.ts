import { describe, expect, it } from "vitest"
import type { AppSupabase } from "@/libs/supabase/types"
import { hitRateLimit } from "./rate-limit"

// Cliente falso: solo responde la RPC mcp_hit_rate_limit
function client(response: { data: unknown; error: unknown }) {
  return { rpc: async () => response } as unknown as AppSupabase
}

describe("hitRateLimit", () => {
  it("permitida da null", async () => {
    expect(
      await hitRateLimit(
        client({ data: [{ allowed: true, retry_after: 0 }], error: null })
      )
    ).toBeNull()
  })

  it("bloqueada da los segundos para reintentar, al menos 1", async () => {
    expect(
      await hitRateLimit(
        client({ data: [{ allowed: false, retry_after: 42 }], error: null })
      )
    ).toBe(42)
    expect(
      await hitRateLimit(
        client({ data: [{ allowed: false, retry_after: 0 }], error: null })
      )
    ).toBe(1)
  })

  it("si la RPC falla o no responde, deja pasar", async () => {
    expect(
      await hitRateLimit(client({ data: null, error: { message: "x" } }))
    ).toBeNull()
    expect(await hitRateLimit(client({ data: [], error: null }))).toBeNull()
  })
})
