"use client"

import { Switch } from "@heroui/react"
import { useHideAmounts } from "@/components/dashboard/hide-amounts-context"

/** Mismo estado que el ojo del header: se guarda en `profiles.hide_amounts` */
export function HideAmountsSwitch() {
  const { hidden, toggle } = useHideAmounts()

  return (
    <Switch
      isSelected={hidden}
      onChange={toggle}
      className="min-h-11"
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <span className="text-sm font-medium">Ocultar cifras</span>
        <span className="text-sm text-muted">
          Saldos, totales y valores de las gráficas se muestran como ***. Los
          montos de cada movimiento siguen visibles. Aplica a Personal, Empresa
          y todos tus dispositivos.
        </span>
      </Switch.Content>
    </Switch>
  )
}
