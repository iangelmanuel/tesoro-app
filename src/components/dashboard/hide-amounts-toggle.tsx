"use client"

import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useHideAmounts } from "./hide-amounts-context"

/** Ojo del header: oculta o muestra saldos y totales en todo el dashboard */
export function HideAmountsToggle() {
  const { hidden, toggle } = useHideAmounts()
  const Icon = hidden ? EyeOff : Eye

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={hidden ? "Mostrar cifras" : "Ocultar cifras"}
      aria-pressed={hidden}
      data-tour="header-amounts"
      onClick={toggle}
    >
      <Icon className="size-4" />
    </Button>
  )
}
