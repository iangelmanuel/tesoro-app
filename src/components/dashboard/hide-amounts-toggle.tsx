"use client"

import { Button } from "@heroui/react"
import { Eye, EyeOff } from "lucide-react"
import { useHideAmounts } from "./hide-amounts-context"

/** Ojo del header: oculta o muestra saldos y totales en todo el dashboard */
export function HideAmountsToggle() {
  const { hidden, toggle } = useHideAmounts()
  const Icon = hidden ? EyeOff : Eye

  return (
    <Button
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={hidden ? "Mostrar cifras" : "Ocultar cifras"}
      aria-pressed={hidden}
      className="max-md:size-11"
      onPress={toggle}
    >
      <Icon className="size-4" />
    </Button>
  )
}
