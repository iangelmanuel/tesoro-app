// Reparto de un pago entre periodos, del más antiguo al más reciente
// (SPEC 38, compartido con SPEC 39). Es la misma regla que aplica la RPC
// `allocate_income_receipt`: el cliente solo la usa para la vista previa y
// el servidor es el que manda.
//
// Regla:
// - Los periodos se recorren en el orden recibido (el llamador los ordena del
//   más antiguo al más reciente).
// - Los periodos con `due` <= 0 se saltan.
// - Cada periodo recibe min(lo que falta del pago, `due`).
// - Lo que no cabe en ningún periodo queda en `leftover`.
// - Se trabaja en centavos para no arrastrar errores de coma flotante.

export interface Period {
  key: string // due_on o period_on
  due: number // lo que falta en ese periodo
}

export interface Allocation {
  key: string
  amount: number
}

const toCents = (value: number) => Math.round(value * 100)

/** Reparte `amount` desde el primer periodo; `leftover` > 0 si sobra */
export function allocateOldestFirst(
  periods: Period[],
  amount: number
): { allocations: Allocation[]; leftover: number } {
  let remaining = Math.max(toCents(amount), 0)
  const allocations: Allocation[] = []

  for (const period of periods) {
    if (remaining === 0) break
    const due = toCents(period.due)
    if (due <= 0) continue
    const cents = Math.min(remaining, due)
    allocations.push({ key: period.key, amount: cents / 100 })
    remaining -= cents
  }

  return { allocations, leftover: remaining / 100 }
}
