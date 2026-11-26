import type { PaymentTabsData } from "@/features/transactions/components/transaction-form-panels"
import { loadQuickActionsFormData } from "./actions"

// Datos de los formularios de los accesos rápidos (SPEC 57), pedidos una
// vez por carga del layout. La llave es el objeto de props que el servidor
// manda al proveedor: una escritura revalida la ruta, llega un objeto nuevo
// y la siguiente apertura vuelve a pedirlos. Así nunca se muestran más
// viejos que la última revalidación, sin TTL
let slot: { key: object; promise: Promise<PaymentTabsData | null> } | null =
  null

/**
 * Pide (o reusa) los datos de los formularios. Resuelve null si fallan; el
 * fallo se olvida para que el siguiente intento los pida de nuevo
 */
export function loadFormData(key: object): Promise<PaymentTabsData | null> {
  if (slot?.key === key) {
    return slot.promise
  }
  const promise = loadQuickActionsFormData().catch(() => {
    if (slot?.promise === promise) {
      slot = null
    }
    return null
  })
  slot = { key, promise }
  return promise
}
