"use client"

import { useTransition } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { MonthSwitcher } from "./month-switcher"

interface MonthNavProps {
  /** Ruta de la página; el mes va en `?month=YYYY-MM` */
  path: string
  /** "octubre 2026" */
  label: string
  /** Mes anterior y siguiente (YYYY-MM); null deshabilita el botón */
  prev: string | null
  next: string | null
  on?: "page" | "card"
  className?: string
  "data-tour"?: string
}

/**
 * `MonthSwitcher` conectado a `?month`: reemplaza el parámetro sin mover el
 * scroll. Lo usan Gastos fijos, Ingresos fijos y Presupuestos.
 */
export function MonthNav({
  path,
  label,
  prev,
  next,
  on,
  className,
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
    <MonthSwitcher
      label={label}
      onPrev={prev === null ? null : () => goTo(prev)}
      onNext={next === null ? null : () => goTo(next)}
      pending={pending}
      on={on}
      className={className}
      data-tour={dataTour}
    />
  )
}
