"use client"

import {
  createContext,
  useContext,
  useMemo,
  useOptimistic,
  useTransition
} from "react"
import { toast } from "@heroui/react"
import { setHideAmountsAction } from "@/features/account/actions"
import { AMOUNT_MASK, formatCurrency } from "@/libs/format"

interface HideAmountsValue {
  /** true: saldos y totales se muestran como `***` */
  hidden: boolean
  /** Alterna al instante y guarda en `profiles.hide_amounts` */
  toggle: () => void
}

const HideAmountsContext = createContext<HideAmountsValue | null>(null)

// `initial` viene del servidor: el primer render ya sale oculto, sin parpadeo.
// El estado optimista da respuesta inmediata; si guardar falla, vuelve atrás.
export function HideAmountsProvider({
  initial,
  children
}: Readonly<{ initial: boolean; children: React.ReactNode }>) {
  const [hidden, setOptimistic] = useOptimistic(initial)
  const [, startTransition] = useTransition()

  const value = useMemo<HideAmountsValue>(
    () => ({
      hidden,
      toggle: () => {
        const next = !hidden

        startTransition(async () => {
          setOptimistic(next)
          const { error } = await setHideAmountsAction(next)

          if (error) {
            toast.danger(error)
          }
        })
      }
    }),
    [hidden, setOptimistic]
  )

  return (
    <HideAmountsContext.Provider value={value}>
      {children}
    </HideAmountsContext.Provider>
  )
}

export function useHideAmounts() {
  const context = useContext(HideAmountsContext)

  if (!context) {
    throw new Error(
      "useHideAmounts debe usarse dentro de <HideAmountsProvider />"
    )
  }

  return context
}

/**
 * Formateador de montos para código que no puede usar <Amount />: etiquetas
 * de SVG, tooltips y tablas solo para lectores de pantalla. Con las cifras
 * ocultas devuelve la máscara.
 */
export function useFormatAmount() {
  const { hidden } = useHideAmounts()

  return {
    hidden,
    money: (value: number, currency: string, fractionDigits?: number) =>
      hidden ? AMOUNT_MASK : formatCurrency(value, currency, fractionDigits)
  }
}
