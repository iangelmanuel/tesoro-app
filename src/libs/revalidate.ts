import { revalidatePath } from "next/cache"
import { SITE } from "@/config/site"

// Movimientos, gastos fijos y presupuestos se cruzan en Resumen,
// Movimientos, Presupuestos y Reportes. Revalidar el layout del espacio
// Personal invalida todas sus páginas y actualiza la actual. Solo en Server
// Actions.
export function revalidatePersonalPages() {
  revalidatePath(SITE.routes.dashboardPersonal, "layout")
}
