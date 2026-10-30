import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

/**
 * Refresca la sesión de Supabase y la propaga a la request y la respuesta.
 * Devuelve la respuesta con las cookies actualizadas y el usuario validado
 * contra el servidor de auth (`getUser`), o `null` si no hay sesión.
 */
export async function updateSession(request: NextRequest) {
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

  // No poner código entre createServerClient y getUser: la llamada es la que
  // refresca el token y escribe las cookies.
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return { response, user }
}
