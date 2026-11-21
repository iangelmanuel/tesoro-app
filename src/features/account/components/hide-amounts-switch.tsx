"use client"

import { useId } from "react"
import { useHideAmounts } from "@/components/dashboard/hide-amounts-context"
import { Switch } from "@/components/ui/switch"

/** Mismo estado que el ojo del header: se guarda en `profiles.hide_amounts` */
export function HideAmountsSwitch() {
  const { hidden, toggle } = useHideAmounts()
  const descriptionId = useId()

  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <Switch
        checked={hidden}
        onCheckedChange={toggle}
        aria-describedby={descriptionId}
        className="mt-0.5"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">Ocultar cifras</span>
        <span
          id={descriptionId}
          className="text-sm text-muted-foreground"
        >
          Saldos, totales y valores de las gráficas se muestran como ***. Los
          montos de cada movimiento siguen visibles. Aplica a Personal, Empresa
          y todos tus dispositivos.
        </span>
      </span>
    </label>
  )
}
