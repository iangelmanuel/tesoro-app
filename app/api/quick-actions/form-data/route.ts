import { getQuickActionsFormData } from "@/components/dashboard/quick-actions/form-data-query"
import { createClient } from "@/libs/supabase/server"

// Datos de los formularios de los accesos rápidos de Personal (SPEC 57):
// metas, deudas, cobros, gastos fijos sin pagar e ingresos fijos. Los pide el
// cliente al abrir el formulario o al pasar por su disparador. Lee con la
// sesión del usuario y RLS, nunca con service_role, y no se guarda en caché

function noStore(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return noStore({ error: "Inicia sesión para ver tus datos" }, 401)
  }

  return noStore(await getQuickActionsFormData())
}
