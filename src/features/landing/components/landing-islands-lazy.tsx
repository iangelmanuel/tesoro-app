"use client"

import { Suspense } from "react"
import { lazyWithPreload } from "@/libs/lazy-with-preload"

type TourItem = {
  title: string
  description: string
  slug: string
  sources: { mp4: string; webm: string; poster: string }
}

// Islas de la landing que van bajo el pliegue (SPEC 56c). El servidor las
// pinta igual; su JS (y el de motion, que solo usan ellas) se descarga
// aparte y se hidrata al llegar, sin bloquear el primer pintado
const DemoPlayer = lazyWithPreload(() =>
  import("./demo-player").then((module) => module.DemoPlayer)
)
const FeatureTour = lazyWithPreload(() =>
  import("./feature-tour").then((module) => module.FeatureTour)
)

// Solo se ven si la isla se pinta en el cliente sin HTML del servidor: el
// mismo contenedor, para que no salte el layout
export function DemoPlayerLazy() {
  return (
    <Suspense
      fallback={
        <div className="aspect-video rounded-3xl bg-[#dff5ea] shadow-[0_40px_80px_-40px_rgba(2,44,34,0.55),0_12px_24px_-12px_rgba(2,44,34,0.25)]" />
      }
    >
      <DemoPlayer.Component />
    </Suspense>
  )
}

export function FeatureTourLazy({ items }: { items: TourItem[] }) {
  return (
    <Suspense fallback={<div className="aspect-video rounded-3xl bg-subtle" />}>
      <FeatureTour.Component items={items} />
    </Suspense>
  )
}
