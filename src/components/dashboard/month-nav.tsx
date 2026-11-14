"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Button, cn } from "@heroui/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CONTROL_BUTTON } from "@/components/dashboard/surface"

interface MonthNavProps {
  /** Ruta de la página; el mes va en `?month=YYYY-MM` */
  path: string
  /** "octubre 2026" */
  label: string
  /** Mes anterior y siguiente (YYYY-MM); null deshabilita el botón */
  prev: string | null
  next: string | null
  "data-tour"?: string
}

/**
 * Anterior, mes y siguiente. Reemplaza `?month` sin mover el scroll. Las
 * flechas miden 44 px en el teléfono.
 */
export function MonthNav({
  path,
  label,
  prev,
  next,
  "data-tour": dataTour
}: MonthNavProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function goTo(value: string) {
    startTransition(() => {
      router.replace(`${path}?month=${value}` as Route, { scroll: false })
    })
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 transition-opacity",
        pending && "opacity-60"
      )}
      data-tour={dataTour}
    >
      <Button
        variant="ghost"
        isIconOnly
        className={cn(CONTROL_BUTTON, "max-md:size-11")}
        aria-label="Mes anterior"
        isDisabled={prev === null}
        onPress={() => prev !== null && goTo(prev)}
      >
        <ChevronLeft />
      </Button>
      <p
        className="min-w-36 text-center font-medium capitalize"
        aria-live="polite"
      >
        {label}
      </p>
      <Button
        variant="ghost"
        isIconOnly
        className={cn(CONTROL_BUTTON, "max-md:size-11")}
        aria-label="Mes siguiente"
        isDisabled={next === null}
        onPress={() => next !== null && goTo(next)}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
