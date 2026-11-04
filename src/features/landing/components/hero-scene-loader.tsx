"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { cn } from "@heroui/react"

// El chunk de three/R3F solo se pide cuando de verdad se va a usar
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false })

type NetworkInformation = { saveData?: boolean }

// Decide si el hero lleva la escena 3D (SPEC 24): solo desde 768 px, sin
// `prefers-reduced-motion` ni ahorro de datos, tras `requestIdleCallback` y
// con el hero en pantalla. El mockup (`children`) se queda como fallback y
// marca el tamaño, así que el cambio no mueve el layout.
export function HeroSceneLoader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const allowed = window.matchMedia(
      "(min-width: 768px) and (prefers-reduced-motion: no-preference)"
    ).matches
    const saveData =
      (navigator as Navigator & { connection?: NetworkInformation }).connection
        ?.saveData === true
    if (!allowed || saveData) return

    let idle: number | undefined
    const schedule = () => {
      if (idle !== undefined) return
      idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(() => setEnabled(true), {
              timeout: 2500
            })
          : window.setTimeout(() => setEnabled(true), 1200)
    }

    const observer = new IntersectionObserver(([entry]) => {
      const inView = entry?.isIntersecting ?? false
      setVisible(inView)
      if (inView) schedule()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      if (idle === undefined) return
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle)
      }
      window.clearTimeout(idle)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative"
    >
      <div
        className={cn(
          "transition-opacity duration-300",
          ready && "pointer-events-none opacity-0"
        )}
      >
        {children}
      </div>
      {enabled && (
        // El lienzo es más grande que la columna y se difumina hacia los
        // bordes: la escena no se ve encerrada en un cuadro
        <div
          className={cn(
            "pointer-events-none absolute -inset-x-20 -inset-y-24 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_72%)] transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0"
          )}
        >
          <HeroScene
            active={visible}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  )
}
