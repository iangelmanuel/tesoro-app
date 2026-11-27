import type { PaymentTabsData } from "@/features/transactions/components/transaction-form-panels"

/** Route Handler que devuelve los datos (`app/api/quick-actions/form-data`) */
const FORM_DATA_URL = "/api/quick-actions/form-data"

// GET con la sesión del navegador; cualquier error (sin sesión, red) lanza
async function fetchFormData(): Promise<PaymentTabsData> {
  const response = await fetch(FORM_DATA_URL, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`form-data ${response.status}`)
  }
  return (await response.json()) as PaymentTabsData
}

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
  const promise: Promise<PaymentTabsData | null> & {
    status?: "fulfilled"
    value?: PaymentTabsData | null
  } = fetchFormData()
    .catch(() => {
      if (slot?.promise === promise) {
        slot = null
      }
      return null
    })
    .then((data) => {
      // Protocolo de thenables de React: con la promesa ya resuelta (por la
      // precarga), `use` lee el valor en el acto en vez de suspender y pintar
      // un commit de skeleton
      promise.status = "fulfilled"
      promise.value = data
      return data
    })
  slot = { key, promise }
  return promise
}
