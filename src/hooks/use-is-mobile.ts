"use client"

import { useSyncExternalStore } from "react"

// Corte móvil del dashboard: el mismo `md` (768 px) que usa el sidebar
export const MOBILE_QUERY = "(max-width: 767px)"

function subscribeMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

// En el servidor se asume escritorio: el aside se pinta en md+
export function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}
