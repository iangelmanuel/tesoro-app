"use client"

import { useState } from "react"

/**
 * Si un diálogo controlado ya se abrió alguna vez (SPEC 57). Montarlo solo
 * desde entonces evita hidratar diálogos cerrados al entrar; después queda
 * montado, así el cierre anima y el estado que sobrevive al cerrar (pestaña,
 * selección) se conserva como antes.
 *
 * ```tsx
 * const opened = useOpenedOnce(open)
 * return opened && <MyDialog open={open} onOpenChange={setOpen} />
 * ```
 */
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open)

  // Ajuste de estado durante el render (patrón de React para derivar de
  // una prop): sin efecto, el diálogo monta abierto en el mismo commit
  if (open && !opened) {
    setOpened(true)
  }

  return opened || open
}
