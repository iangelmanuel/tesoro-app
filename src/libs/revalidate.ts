import { revalidatePath } from "next/cache"
import { SITE } from "@/config/site"

// Movimientos, gastos fijos, presupuestos, metas y deudas se cruzan en
// Resumen, Movimientos, Presupuestos, Reportes, Metas y Deudas (un pago de
// préstamo o un abono crea un movimiento). Revalidar el layout del espacio
// Personal invalida todas sus páginas, incluida /dashboard/personal/debts, y
// actualiza la actual. Solo en Server Actions.
export function revalidatePersonalPages() {
  revalidatePath(SITE.routes.dashboardPersonal, "layout")
}
