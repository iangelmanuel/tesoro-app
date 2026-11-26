import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { JwtPayload } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Refresca la sesión de Supabase y la propaga a la request y la respuesta.
 * Devuelve la respuesta con las cookies actualizadas y los claims del JWT, o
 * `null` si no hay sesión. `getClaims` verifica la firma con las claves
 * públicas (JWKS, ES256) sin ir al servidor de auth (SPEC 56a): un token
 * revocado vale hasta que expira, pero el proxy solo decide redirecciones y
 * los datos siguen detrás de RLS y de `getSessionUser`.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        }
      }
    }
  )

  // No poner código entre createServerClient y getClaims: la llamada es la que
  // refresca el token y escribe las cookies. Una cookie con un JWT malformado
  // hace que getClaims lance: cuenta como sin sesión
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }))

  return { response, claims: data?.claims ?? null }
}
