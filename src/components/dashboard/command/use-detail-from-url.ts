"use client"

import { useEffect, useState } from "react"
import { DETAIL_PARAM, OPEN_DETAIL_EVENT } from "./detail-param"

/**
 * Estado abierto/cerrado del panel de detalle de una entidad (deuda, meta)
 * que la paleta de comandos puede abrir: al montarse lee `?detalle=<id>` (y
 * lo quita de la URL) y, con la página ya abierta, escucha el evento de la
 * paleta. Lee window y no useSearchParams para no suspender la tarjeta al
 * prerenderizar
 */
export function useDetailFromUrl(id: string) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get(DETAIL_PARAM) === id) {
      url.searchParams.delete(DETAIL_PARAM)
      window.history.replaceState(window.history.state, "", url)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre el panel pedido por la URL al montar
      setOpen(true)
    }

    function onOpen(event: Event) {
      if ((event as CustomEvent<{ id: string }>).detail?.id === id) {
        setOpen(true)
      }
    }

    window.addEventListener(OPEN_DETAIL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_DETAIL_EVENT, onOpen)
  }, [id])

  return [open, setOpen] as const
}
